import { join } from "node:path";
import { appendRow } from "../csv.js";
import { readNodeList } from "../networks.js";
import { check } from "./check.js";

const HEADER = ["checked_at", "address", "passed", "s_connect", "tip", "reference_tip", "reasons"];

/**
 * Checks every node in nodes/<network>.json once and appends a row per node
 * to data/uptime/<network>.csv. Run it hourly (the uptime workflow does).
 */
export async function uptime(opts: { root: string; network: "mainnet" | "testnet"; out?: string; log?: (line: string) => void }) {
  const nodes = readNodeList(opts.root, opts.network);
  const file = opts.out ?? join(opts.root, "data", "uptime", `${opts.network}.csv`);
  const results = [];
  for (const node of nodes) {
    const r = await check({ root: opts.root, address: node.address, network: opts.network, durationSec: 120 });
    appendRow(file, HEADER, [r.checkedAt, r.address, r.passed, r.secondsToConnect, r.tip, r.referenceTip, r.reasons.join(" | ") || undefined]);
    opts.log?.(`${r.passed ? "PASS" : "FAIL"}  ${r.address}`);
    results.push(r);
  }
  return { file, results };
}
