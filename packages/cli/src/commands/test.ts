import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runProbe, type JsonScript, type Network, type ProbeEvent } from "@ckb-lifeline/probe";
import { appendRow } from "../csv.js";
import { loadProfile, type NetworkProfile } from "../networks.js";
import { cellsCapacity, tipNumber, transactionStatus } from "../rpc.js";
import { buildTransfer, DEVNET_KEY, lockOf } from "../transfer.js";
import {
  isConnected,
  isCutOff,
  PEERS_TO_SYNC,
  TIP_LAG_LIMIT,
  trialMetrics,
  verdictH1,
  verdictH2,
  verdictH3,
  verdictH4,
  type TrialMetrics,
  type Verdict,
} from "../verdict.js";

export type Condition = "A" | "B" | "C" | "E" | "F";

export const CONDITIONS: Record<Condition, string> = {
  A: "usual peers reachable",
  B: "usual peers blocked",
  C: "usual peers blocked, independent peers listed",
  E: "usual peers blocked, one independent peer fewer",
  F: "as C, and a transaction sent through the light client",
};

export interface TestOptions {
  root: string;
  network: Network;
  conditions: Condition[];
  trials: number;
  durationSec: number;
  location: string;
  extraNodes: string[];
  watch?: { address: string; fromBlock: string };
  out?: string;
  log?: (line: string) => void;
}

interface Plan {
  bootnodes: string[];
  block: string[];
  /** B runs its full length: the question is whether peers ever appear. */
  stopWhenSynced: boolean;
  send: boolean;
}

export function planFor(condition: Condition, p: NetworkProfile): Plan {
  const block = [p.referencePattern];
  switch (condition) {
    case "A":
      return { bootnodes: p.reference, block: [], stopWhenSynced: true, send: false };
    case "B":
      return { bootnodes: p.reference, block, stopWhenSynced: false, send: false };
    case "C":
      return { bootnodes: [...p.reference, ...p.independent], block, stopWhenSynced: true, send: false };
    case "E":
      return { bootnodes: [...p.reference, ...p.independent.slice(0, -1)], block, stopWhenSynced: true, send: false };
    case "F":
      return { bootnodes: [...p.reference, ...p.independent], block, stopWhenSynced: true, send: true };
  }
}

const TRIAL_HEADER = [
  "run", "location", "network", "condition", "trial", "started_at", "seconds",
  "peers_at_end", "peers_max", "s_first_peer", "s_two_peers", "s_synced",
  "tip_at_end", "reference_tip", "tip_lag", "connected", "cut_off",
  "light_capacity", "reference_capacity", "tx_hash", "s_tx_committed", "errors",
];

export interface TestSummary {
  dir: string;
  verdicts: Verdict[];
  byCondition: Partial<Record<Condition, TrialMetrics[]>>;
}

export async function test(opts: TestOptions): Promise<TestSummary> {
  const log = opts.log ?? (() => {});
  const profile = loadProfile(opts.root, opts.network, opts.extraNodes);
  const needsIndependent = opts.conditions.some((c) => c === "C" || c === "E" || c === "F");
  if (needsIndependent && profile.independent.length === 0) {
    throw new Error(`Conditions C, E and F need independent nodes: list them in nodes/${opts.network}.json or pass --node.`);
  }
  if (opts.conditions.includes("F") && opts.network === "mainnet") {
    throw new Error("Condition F sends a transaction; run it on testnet or the devnet, not mainnet.");
  }

  const run = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = resolve(opts.out ?? join(opts.root, "data", "results", `${run.slice(0, 10)}-${opts.network}-${opts.location}`));
  mkdirSync(dir, { recursive: true });
  const trialsCsv = join(dir, "trials.csv");
  const samplesJsonl = join(dir, "samples.jsonl");

  const watchScript: JsonScript | undefined = opts.watch ? await lockOf(opts.watch.address, opts.network) : undefined;
  const byCondition: Partial<Record<Condition, TrialMetrics[]>> = {};
  const capacities: { light: bigint; reference: bigint }[] = [];
  const committed: (number | undefined)[] = [];

  for (const condition of opts.conditions) {
    const plan = planFor(condition, profile);
    for (let trial = 1; trial <= opts.trials; trial++) {
      log(`${condition}${trial}  ${CONDITIONS[condition]}`);
      const startedAt = new Date().toISOString();
      const referenceAtStart = await tipNumber(profile.referenceRpc).catch(() => undefined);

      let transfer: Awaited<ReturnType<typeof buildTransfer>> | undefined;
      if (plan.send) {
        const key = opts.network === "devnet" ? DEVNET_KEY : process.env.LIFELINE_TX_KEY;
        if (!key) throw new Error("Condition F on testnet needs a funded key in LIFELINE_TX_KEY.");
        transfer = await buildTransfer(opts.network as "devnet" | "testnet", profile.referenceRpc, key);
      }

      const doneWhen = (events: readonly ProbeEvent[]) => {
        if (!plan.stopWhenSynced) return false;
        const last = events.findLast((e) => e.kind === "sample");
        if (last?.kind !== "sample") return false;
        const tip = last.sample.tip === undefined ? 0n : BigInt(last.sample.tip);
        const synced = last.sample.peers.length >= PEERS_TO_SYNC && tip > 0n && (referenceAtStart === undefined || tip + TIP_LAG_LIMIT >= referenceAtStart);
        const sentOk = !plan.send || events.some((e) => e.kind === "sent" || e.kind === "error");
        const capacityOk = !watchScript || events.some((e) => e.kind === "capacity");
        return synced && sentOk && capacityOk;
      };

      const result = await runProbe({
        request: {
          network: opts.network,
          bootnodes: plan.bootnodes,
          maxOutboundPeers: 4,
          devnetSpec: profile.devnetSpec,
          watch: watchScript && opts.watch ? { script: watchScript, fromBlock: opts.watch.fromBlock } : undefined,
          sendTransaction: transfer?.forLightClient,
          sampleEveryMs: 2000,
        },
        durationMs: opts.durationSec * 1000,
        block: plan.block,
        map: profile.map,
        insecureTls: profile.insecureTls,
        done: doneWhen,
      });

      const referenceAtEnd = await tipNumber(profile.referenceRpc).catch(() => undefined);
      const metrics = trialMetrics(result.samples, referenceAtStart, referenceAtEnd);
      (byCondition[condition] ??= []).push(metrics);

      let lightCapacity: bigint | undefined;
      let referenceCapacity: bigint | undefined;
      const capacityEvent = result.events.find((e) => e.kind === "capacity");
      if (watchScript && capacityEvent?.kind === "capacity") {
        lightCapacity = BigInt(capacityEvent.capacity);
        referenceCapacity = await cellsCapacity(profile.referenceRpc, watchScript).catch(() => undefined);
        if (referenceCapacity !== undefined) capacities.push({ light: lightCapacity, reference: referenceCapacity });
      }

      let txSeconds: number | undefined;
      const sent = result.events.find((e) => e.kind === "sent");
      if (transfer) {
        if (sent?.kind === "sent") {
          const t0 = Date.now();
          while (Date.now() - t0 < 600_000) {
            if ((await transactionStatus(profile.referenceRpc, transfer.hash).catch(() => undefined)) === "committed") {
              txSeconds = Math.round((Date.now() - t0) / 1000);
              break;
            }
            await new Promise((r) => setTimeout(r, 3000));
          }
        }
        committed.push(txSeconds);
      }

      const errors = result.events.flatMap((e) => (e.kind === "error" ? [e.message] : [])).join(" | ");
      appendRow(trialsCsv, TRIAL_HEADER, [
        run, opts.location, opts.network, condition, trial, startedAt, Math.round(result.durationMs / 1000),
        metrics.peersAtEnd, metrics.peersMax, metrics.secondsToFirstPeer, metrics.secondsToTwoPeers, metrics.secondsToSynced,
        metrics.tipAtEnd, metrics.referenceTipAtEnd, metrics.tipLag, isConnected(metrics), isCutOff(metrics),
        lightCapacity, referenceCapacity, transfer?.hash, txSeconds, errors || undefined,
      ]);
      appendFileSync(samplesJsonl, JSON.stringify({ run, condition, trial, samples: result.samples }) + "\n");
      log(
        `    peers ${metrics.peersAtEnd} (max ${metrics.peersMax}), tip ${metrics.tipAtEnd ?? "-"} / ${metrics.referenceTipAtEnd ?? "-"}` +
          (transfer ? `, tx ${txSeconds !== undefined ? `committed in ${txSeconds} s` : "not committed"}` : ""),
      );
    }
  }

  const verdicts: Verdict[] = [];
  if (byCondition.B) verdicts.push(verdictH1(byCondition.B));
  if (byCondition.C) verdicts.push(verdictH2(byCondition.C));
  if (capacities.length) verdicts.push(verdictH3(capacities));
  if (committed.length) verdicts.push(verdictH4(committed));

  writeSummary(dir, opts, profile, byCondition, verdicts);
  return { dir, verdicts, byCondition };
}

function writeSummary(
  dir: string,
  opts: TestOptions,
  profile: NetworkProfile,
  byCondition: Partial<Record<Condition, TrialMetrics[]>>,
  verdicts: Verdict[],
) {
  const rows = Object.entries(byCondition).map(([condition, list]) => {
    const connected = list.filter(isConnected).length;
    const cut = list.filter(isCutOff).length;
    return `| ${condition} | ${CONDITIONS[condition as Condition]} | ${list.length} | ${connected} | ${cut} |`;
  });
  const md = [
    `# ${opts.network}, ${opts.location}`,
    "",
    `Usual peers: ${profile.reference.length} addresses matching \`${profile.referencePattern}\`. Independent peers: ${profile.independent.length}.`,
    "",
    "| Condition | What | Trials | Synced | Cut off |",
    "|---|---|---|---|---|",
    ...rows,
    "",
    ...verdicts.map((v) => `- **${v.id} ${v.passed ? "PASS" : "FAIL"}**: ${v.claim}. ${v.detail}.`),
    "",
    "Raw data: `trials.csv` (one row per trial) and `samples.jsonl` (what the light client reported every 2 s).",
    "",
  ].join("\n");
  writeFileSync(join(dir, "summary.md"), md);
  writeFileSync(
    join(dir, "summary.json"),
    JSON.stringify({ network: opts.network, location: opts.location, verdicts }, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2) + "\n",
  );
}
