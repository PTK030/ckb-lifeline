import { runProbe, type Network, type ProbeEvent, type Sample } from "@ckb-lifeline/probe";
import { parseWssAddress } from "../multiaddr.js";
import { loadProfile } from "../networks.js";
import { tipNumber } from "../rpc.js";
import { TIP_LAG_LIMIT } from "../verdict.js";

/** Protocol ids a node must speak for a light client (ckb network/src/protocols/support_protocols.rs). */
const LIGHT_CLIENT = 120;
const FILTER = 121;

export interface CheckOptions {
  root: string;
  address: string;
  network: Network;
  durationSec: number;
  referenceRpc?: string;
}

export interface CheckResult {
  address: string;
  network: Network;
  passed: boolean;
  reasons: string[];
  secondsToConnect?: number;
  protocols?: number[];
  tip?: string;
  referenceTip?: string;
  otherPeers: number;
  checkedAt: string;
  seconds: number;
}

/**
 * Starts a light client in Chromium that can resolve only the node's own
 * domain, with that node as its only peer, and checks that it connects,
 * speaks the light client protocols and brings the tip up to date.
 */
export async function check(opts: CheckOptions): Promise<CheckResult> {
  const target = parseWssAddress(opts.address);
  const profile = opts.network === "devnet" ? loadProfile(opts.root, "devnet") : undefined;
  const referenceRpc = opts.referenceRpc ?? profile?.referenceRpc ?? (opts.network === "mainnet" ? "https://mainnet.ckb.dev/rpc" : "https://testnet.ckb.dev/rpc");
  const checkedAt = new Date().toISOString();

  let referenceAtStart: bigint | undefined;
  try {
    referenceAtStart = await tipNumber(referenceRpc);
  } catch {
    referenceAtStart = undefined;
  }

  const synced = (s: Sample) =>
    s.tip !== undefined &&
    BigInt(s.tip) > 0n &&
    (referenceAtStart === undefined || BigInt(s.tip) + TIP_LAG_LIMIT >= referenceAtStart);
  const ours = (s: Sample) => s.peers.find((p) => p.nodeId === target.peerId);

  const result = await runProbe({
    request: {
      network: opts.network,
      bootnodes: [opts.address],
      maxOutboundPeers: 2,
      devnetSpec: profile?.devnetSpec,
      sampleEveryMs: 2000,
    },
    durationMs: opts.durationSec * 1000,
    only: [target.host],
    map: profile?.map,
    insecureTls: profile?.insecureTls,
    done: (events: readonly ProbeEvent[]) => {
      const last = events.findLast((e) => e.kind === "sample");
      return last?.kind === "sample" && !!ours(last.sample) && synced(last.sample);
    },
  });

  const samples = result.samples;
  const first = samples.find(ours);
  const last = samples.at(-1);
  const peer = last && ours(last);
  const reasons: string[] = [];
  if (!first) reasons.push(`no connection to ${target.host}:${target.port} within ${opts.durationSec} s`);
  const protocols = peer?.protocols ?? (first && ours(first)?.protocols);
  if (first && !(protocols?.includes(LIGHT_CLIENT) && protocols.includes(FILTER))) {
    reasons.push("the node does not offer the LightClient and Filter protocols");
  }
  if (first && !(last && synced(last))) {
    reasons.push(
      referenceAtStart === undefined
        ? "the light client did not get a single header from the node"
        : `the light client's tip did not reach ${referenceAtStart - TIP_LAG_LIMIT} (reference ${referenceAtStart})`,
    );
  }
  for (const e of result.events) if (e.kind === "error") reasons.push(`browser: ${e.message}`);

  return {
    address: opts.address,
    network: opts.network,
    passed: reasons.length === 0,
    reasons,
    secondsToConnect: first ? Math.round(first.t / 100) / 10 : undefined,
    protocols,
    tip: last?.tip,
    referenceTip: referenceAtStart?.toString(),
    otherPeers: last ? last.peers.filter((p) => p.nodeId !== target.peerId).length : 0,
    checkedAt,
    seconds: Math.round(result.durationMs / 1000),
  };
}

export function describeCheck(r: CheckResult): string {
  const lines = [`${r.passed ? "PASS" : "FAIL"}  ${r.address}`];
  if (r.secondsToConnect !== undefined) lines.push(`      connected after ${r.secondsToConnect} s`);
  if (r.tip !== undefined) lines.push(`      tip ${r.tip}${r.referenceTip ? ` (reference ${r.referenceTip})` : ""}`);
  for (const reason of r.reasons) lines.push(`      ${reason}`);
  return lines.join("\n");
}
