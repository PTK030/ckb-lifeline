import { runProbe, type Network, type Sample } from "@ckb-lifeline/probe";
import { parseWssAddress } from "../multiaddr.js";
import { loadProfile } from "../networks.js";
import { tipNumber } from "../rpc.js";

export interface WatchOptions {
  root: string;
  network: Network;
  extraNodes: string[];
  /** Start with the usual peers blocked in the browser, as in condition C. */
  blockUsual: boolean;
  durationSec: number;
  log: (line: string) => void;
}

/**
 * Opens the light client in a visible Chromium with the usual peers and the
 * independent nodes, and prints which of them it is connected to every few
 * seconds. Stopping nodes meanwhile (docker stop) shows what an app sees.
 */
export async function watch(opts: WatchOptions): Promise<void> {
  const profile = loadProfile(opts.root, opts.network, opts.extraNodes);
  const bootnodes = [...profile.reference, ...profile.independent];

  // Peer id -> a short name and whether it is one of the usual peers.
  const names = new Map<string, { name: string; usual: boolean }>();
  for (const address of bootnodes) {
    const { host, peerId } = parseWssAddress(address);
    names.set(peerId, { name: host, usual: profile.reference.includes(address) });
  }

  let referenceTip: bigint | undefined;
  let polling = true;
  const poller = (async () => {
    while (polling) {
      referenceTip = await tipNumber(profile.referenceRpc).catch(() => referenceTip);
      await new Promise((r) => setTimeout(r, 2000));
    }
  })();

  opts.log(`light client: ${opts.network}, ${bootnodes.length} peers listed` + (opts.blockUsual ? `, ${profile.referencePattern} blocked` : ""));
  for (const address of bootnodes) {
    const { host, peerId } = parseWssAddress(address);
    opts.log(`  ${names.get(peerId)!.usual ? "usual      " : "independent"}  ${host}`);
  }
  opts.log("Ctrl+C to stop.\n");

  let seen = 0;
  const print = (s: Sample) => {
    const connected = s.peers.map((p) => {
      const known = names.get(p.nodeId);
      const name = known ? known.name : (p.addresses[0] ?? p.nodeId.slice(0, 12));
      return p.provedTip ? `${name} (#${p.provedTip})` : name;
    });
    const tip = s.tip ?? "-";
    const lag = referenceTip !== undefined ? ` (full node #${referenceTip})` : "";
    const state = s.peers.length >= 2 && s.tip !== undefined && s.tip !== "0" ? "synced " : s.peers.length === 0 ? "cut off" : "waiting";
    const time = `${Math.round(s.t / 1000)} s`.padStart(6);
    opts.log(`${time}  ${state}  tip ${tip}${lag}  peers ${s.peers.length}: ${connected.join(", ") || "none"}`);
  };

  await runProbe({
    request: {
      network: opts.network,
      bootnodes,
      maxOutboundPeers: 4,
      devnetSpec: profile.devnetSpec,
      sampleEveryMs: 2000,
    },
    durationMs: opts.durationSec * 1000,
    block: opts.blockUsual ? [profile.referencePattern] : [],
    map: profile.map,
    insecureTls: profile.insecureTls,
    headless: false,
    done: (events) => {
      for (; seen < events.length; seen++) {
        const e = events[seen]!;
        if (e.kind === "sample") print(e.sample);
        else if (e.kind === "error") opts.log(`error: ${e.message}`);
      }
      return false;
    },
  });
  polling = false;
  await poller;
}
