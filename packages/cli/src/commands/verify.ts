import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Network } from "@ckb-lifeline/probe";
import { isConnected, PEERS_TO_SYNC } from "../verdict.js";
import { test } from "./test.js";

/**
 * The short version of the test, for anyone who wants to see it once:
 * one trial with the usual peers blocked (B), one with independent nodes
 * added (C). A light client should be cut off in B and synced in C.
 */
export async function verify(opts: { root: string; network: Network; extraNodes: string[]; log?: (l: string) => void }) {
  const out = mkdtempSync(join(tmpdir(), "lifeline-verify-"));
  const common = { root: opts.root, network: opts.network, trials: 1, location: "verify", extraNodes: opts.extraNodes, log: opts.log };

  const b = (await test({ ...common, conditions: ["B"], durationSec: 120, out: join(out, "B") })).byCondition.B![0]!;
  const c = (await test({ ...common, conditions: ["C"], durationSec: 300, out: join(out, "C") })).byCondition.C![0]!;

  const lines = [
    `B  usual peers blocked:                     ${isConnected(b) ? "PASS" : "FAIL"}  ${b.peersAtEnd} peers after ${120} s` +
      (b.peersAtEnd < PEERS_TO_SYNC ? ", no sync" : ""),
    `C  usual peers blocked, independent added:  ${isConnected(c) ? "PASS" : "FAIL"}  ` +
      (isConnected(c)
        ? `${c.peersAtEnd} peers, synced in ${c.secondsToSynced ?? c.secondsToTwoPeers} s, tip ${c.tipAtEnd} (reference ${c.referenceTipAtEnd})`
        : `${c.peersAtEnd} peers, tip ${c.tipAtEnd ?? "-"} (reference ${c.referenceTipAtEnd ?? "-"})`),
  ];
  return { lines, expected: !isConnected(b) && isConnected(c), out };
}
