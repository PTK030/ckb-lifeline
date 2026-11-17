import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Network } from "@ckb-lifeline/probe";
import { loadProfile } from "../networks.js";
import { isConnected, PEERS_TO_SYNC } from "../verdict.js";
import { test } from "./test.js";

/**
 * The short version of the test, for anyone who wants to see it once:
 * one trial with the usual peers blocked (B), one with independent nodes
 * added (C). A light client should be cut off in B and synced in C.
 * With no independent nodes listed yet, it runs B alone and says so.
 */
export async function verify(opts: { root: string; network: Network; extraNodes: string[]; log?: (l: string) => void }) {
  const out = mkdtempSync(join(tmpdir(), "lifeline-verify-"));
  const common = { root: opts.root, network: opts.network, trials: 1, location: "verify", extraNodes: opts.extraNodes, log: opts.log };
  const independent = loadProfile(opts.root, opts.network, opts.extraNodes).independent;

  const b = (await test({ ...common, conditions: ["B"], durationSec: 120, out: join(out, "B") })).byCondition.B![0]!;
  const lines = [
    `B  usual peers blocked:                     ${isConnected(b) ? "PASS" : "FAIL"}  ${b.peersAtEnd} peers after ${120} s` +
      (b.peersAtEnd < PEERS_TO_SYNC ? ", no sync" : ""),
  ];

  if (independent.length === 0) {
    lines.push(
      `C  usual peers blocked, independent added:  SKIP  no independent nodes listed in nodes/${opts.network}.json yet;`,
      `   add one with --node <address>, or see C on the local devnet: npm run devnet:up, then lifeline verify --network devnet`,
    );
    return { lines, expected: !isConnected(b), out };
  }

  const c = (await test({ ...common, conditions: ["C"], durationSec: 300, out: join(out, "C") })).byCondition.C![0]!;
  lines.push(
    `C  usual peers blocked, independent added:  ${isConnected(c) ? "PASS" : "FAIL"}  ` +
      (isConnected(c)
        ? `${c.peersAtEnd} peers, synced in ${c.secondsToSynced ?? c.secondsToTwoPeers} s, tip ${c.tipAtEnd} (reference ${c.referenceTipAtEnd})`
        : `${c.peersAtEnd} peers, tip ${c.tipAtEnd ?? "-"} (reference ${c.referenceTipAtEnd ?? "-"})`),
  );
  return { lines, expected: !isConnected(b) && isConnected(c), out };
}
