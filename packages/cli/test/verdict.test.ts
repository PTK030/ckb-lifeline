import { describe, expect, it } from "vitest";
import type { Sample } from "@ckb-lifeline/probe";
import { enough, isConnected, isCutOff, median, trialMetrics, verdictH1, verdictH2, verdictH3, verdictH4 } from "../src/verdict.js";

const peer = (id: string) => ({ nodeId: id, addresses: [], protocols: [120, 121] });
const sample = (t: number, peers: number, tip?: number): Sample => ({
  t: t * 1000,
  peers: Array.from({ length: peers }, (_, i) => peer(`p${i}`)),
  tip: tip === undefined ? undefined : String(tip),
});

describe("trialMetrics", () => {
  it("measures time to peers and to sync", () => {
    const m = trialMetrics([sample(1, 0, 0), sample(6, 1, 0), sample(11, 2, 0), sample(16, 2, 998), sample(21, 2, 1000)], 1000n, 1001n);
    expect(m.secondsToFirstPeer).toBe(6);
    expect(m.secondsToTwoPeers).toBe(11);
    expect(m.secondsToSynced).toBe(16);
    expect(m.tipLag).toBe(1n);
    expect(m.peersMax).toBe(2);
    expect(isConnected(m)).toBe(true);
    expect(isCutOff(m)).toBe(false);
  });

  it("a client stuck at genesis is neither synced nor lagging by a number", () => {
    const m = trialMetrics([sample(1, 0, 0), sample(300, 0, 0)], 1000n, 1000n);
    expect(m.tipLag).toBeUndefined();
    expect(m.secondsToSynced).toBeUndefined();
    expect(isCutOff(m)).toBe(true);
    expect(isConnected(m)).toBe(false);
  });

  it("one peer is still cut off: syncing needs two", () => {
    expect(isCutOff(trialMetrics([sample(300, 1, 0)]))).toBe(true);
  });

  it("a tip more than 3 blocks behind is not synced", () => {
    expect(isConnected(trialMetrics([sample(60, 2, 990)], 1000n, 1000n))).toBe(false);
  });
});

describe("thresholds", () => {
  it("9 of 10 is enough, 8 of 10 is not", () => {
    expect(enough(9, 10)).toBe(true);
    expect(enough(8, 10)).toBe(false);
    expect(enough(0, 0)).toBe(false);
  });

  it("median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeUndefined();
  });

  it("H1 passes when blocked clients stay below two peers", () => {
    const cut = trialMetrics([sample(300, 0, 0)]);
    const ok = trialMetrics([sample(300, 2, 1000)], 1000n, 1000n);
    expect(verdictH1([...Array(9).fill(cut), ok]).passed).toBe(true);
    expect(verdictH1([...Array(8).fill(cut), ok, ok]).passed).toBe(false);
  });

  it("H2 needs both: enough synced trials and a median under 120 s", () => {
    const fast = trialMetrics([sample(10, 2, 1000)], 1000n, 1000n);
    const slow = trialMetrics([sample(130, 2, 1000)], 1000n, 1000n);
    expect(verdictH2(Array(10).fill(fast)).passed).toBe(true);
    expect(verdictH2(Array(10).fill(slow)).passed).toBe(false);
  });

  it("H3 needs every balance equal", () => {
    expect(verdictH3([{ light: 5n, reference: 5n }]).passed).toBe(true);
    expect(verdictH3([{ light: 5n, reference: 5n }, { light: 4n, reference: 5n }]).passed).toBe(false);
    expect(verdictH3([]).passed).toBe(false);
  });

  it("H4 counts transactions committed within 10 minutes", () => {
    expect(verdictH4([...Array(9).fill(30), undefined]).passed).toBe(true);
    expect(verdictH4([...Array(9).fill(30), 601]).passed).toBe(true);
    expect(verdictH4([...Array(8).fill(30), 601, undefined]).passed).toBe(false);
  });
});
