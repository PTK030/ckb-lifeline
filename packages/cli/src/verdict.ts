// Turns what the probe saw into numbers, and the numbers into the pass/fail
// lines of docs/test-protocol.md. Pure functions, so the thresholds are tested.

import type { Sample } from "@ckb-lifeline/probe";

/** A light client starts syncing with 2 peers (max_outbound_peers 4 / 2). */
export const PEERS_TO_SYNC = 2;
/** Our tip may trail the reference by this many blocks and count as synced. */
export const TIP_LAG_LIMIT = 3n;

export interface TrialMetrics {
  peersAtEnd: number;
  peersMax: number;
  secondsToFirstPeer?: number;
  secondsToTwoPeers?: number;
  /** First moment our tip was within TIP_LAG_LIMIT of the reference tip at the start. */
  secondsToSynced?: number;
  tipAtEnd?: bigint;
  referenceTipAtEnd?: bigint;
  tipLag?: bigint;
}

export function trialMetrics(samples: readonly Sample[], referenceTipAtStart?: bigint, referenceTipAtEnd?: bigint): TrialMetrics {
  const last = samples.at(-1);
  const seconds = (s: Sample | undefined) => (s ? Math.round(s.t / 100) / 10 : undefined);
  const tipAtEnd = last?.tip !== undefined ? BigInt(last.tip) : undefined;
  const synced =
    referenceTipAtStart === undefined
      ? undefined
      : samples.find((s) => s.tip !== undefined && BigInt(s.tip) > 0n && BigInt(s.tip) + TIP_LAG_LIMIT >= referenceTipAtStart);
  const lag =
    tipAtEnd !== undefined && referenceTipAtEnd !== undefined && tipAtEnd > 0n
      ? (referenceTipAtEnd > tipAtEnd ? referenceTipAtEnd - tipAtEnd : 0n)
      : undefined;
  return {
    peersAtEnd: last?.peers.length ?? 0,
    peersMax: samples.reduce((m, s) => Math.max(m, s.peers.length), 0),
    secondsToFirstPeer: seconds(samples.find((s) => s.peers.length >= 1)),
    secondsToTwoPeers: seconds(samples.find((s) => s.peers.length >= PEERS_TO_SYNC)),
    secondsToSynced: seconds(synced),
    tipAtEnd,
    referenceTipAtEnd,
    tipLag: lag,
  };
}

/** Enough peers to sync, and a tip close to the reference. */
export function isConnected(m: TrialMetrics): boolean {
  return m.peersAtEnd >= PEERS_TO_SYNC && m.tipLag !== undefined && m.tipLag <= TIP_LAG_LIMIT;
}

/** Fewer peers than a light client needs to sync. */
export function isCutOff(m: TrialMetrics): boolean {
  return m.peersAtEnd < PEERS_TO_SYNC;
}

export function median(values: readonly number[]): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export interface Verdict {
  id: string;
  claim: string;
  passed: boolean;
  detail: string;
}

/** At least 90% of the trials, rounded up: 9 of 10. */
export function enough(hits: number, trials: number): boolean {
  return trials > 0 && hits >= Math.ceil(trials * 0.9);
}

/** H1: without the reference peers, a light client with the usual list is cut off. */
export function verdictH1(b: readonly TrialMetrics[]): Verdict {
  const hits = b.filter(isCutOff).length;
  return {
    id: "H1",
    claim: "Blocking the usual peers cuts the light client off",
    passed: enough(hits, b.length),
    detail: `${hits}/${b.length} trials ended with fewer than ${PEERS_TO_SYNC} peers`,
  };
}

/** H2: independent peers restore sync, quickly. */
export function verdictH2(c: readonly TrialMetrics[]): Verdict {
  const hits = c.filter(isConnected).length;
  const med = median(c.flatMap((m) => (m.secondsToTwoPeers === undefined ? [] : [m.secondsToTwoPeers])));
  const fast = med !== undefined && med <= 120;
  return {
    id: "H2",
    claim: "Independent peers restore sync",
    passed: enough(hits, c.length) && fast,
    detail: `${hits}/${c.length} trials synced to within ${TIP_LAG_LIMIT} blocks; median time to ${PEERS_TO_SYNC} peers ${med ?? "n/a"} s (limit 120 s)`,
  };
}

/** H3: the balance the light client reads matches a full node's. */
export function verdictH3(checks: readonly { light: bigint; reference: bigint }[]): Verdict {
  const hits = checks.filter((c) => c.light === c.reference).length;
  return {
    id: "H3",
    claim: "Balances match a full node",
    passed: checks.length > 0 && hits === checks.length,
    detail: `${hits}/${checks.length} balances equal to the reference`,
  };
}

/** H4: a transaction sent through the light client is committed within 10 minutes. */
export function verdictH4(seconds: readonly (number | undefined)[]): Verdict {
  const hits = seconds.filter((s) => s !== undefined && s <= 600).length;
  return {
    id: "H4",
    claim: "Transactions go through without the usual peers",
    passed: enough(hits, seconds.length),
    detail: `${hits}/${seconds.length} transactions committed within 10 minutes`,
  };
}
