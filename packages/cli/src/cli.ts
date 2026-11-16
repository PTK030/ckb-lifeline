#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import type { Network } from "@ckb-lifeline/probe";
import { check, describeCheck } from "./commands/check.js";
import { CONDITIONS, test, type Condition } from "./commands/test.js";
import { uptime } from "./commands/uptime.js";

const HELP = `lifeline: CKB nodes for light clients in the browser

Usage
  lifeline check <address> [--network mainnet|testnet|devnet] [--seconds 180] [--json]
      Starts the light client in Chromium with this node as its only peer and
      checks that it connects and syncs. <address> is the node's
      /dns4/<domain>/tcp/443/wss/p2p/<peer id>.

  lifeline test [--network mainnet] [--conditions A,B,C] [--trials 10]
                [--seconds 300] [--location local] [--node <address>]...
                [--watch <ckb address> --from-block <n>] [--out <dir>]
      Runs the light client with the usual peers blocked and not, with and
      without independent nodes, and writes the raw results to data/results/.
${Object.entries(CONDITIONS).map(([c, d]) => `        ${c}  ${d}`).join("\n")}

  lifeline uptime [--network mainnet] [--out <file>]
      Checks every node in nodes/<network>.json and appends a row each to
      data/uptime/<network>.csv.

Options
  --root <dir>   The repository (default: found from the current directory)
  -h, --help     This text
`;

function findRoot(start: string): string {
  for (let dir = resolve(start); ; dir = dirname(dir)) {
    if (existsSync(join(dir, "nodes", "mainnet.json"))) return dir;
    if (dirname(dir) === dir) break;
  }
  return resolve(fileURLToPath(new URL("../../..", import.meta.url)));
}

function network(value: string | undefined): Network {
  const n = value ?? "mainnet";
  if (n !== "mainnet" && n !== "testnet" && n !== "devnet") throw new Error(`--network must be mainnet, testnet or devnet, not ${n}`);
  return n;
}

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      network: { type: "string" },
      seconds: { type: "string" },
      json: { type: "boolean" },
      conditions: { type: "string" },
      trials: { type: "string" },
      location: { type: "string" },
      node: { type: "string", multiple: true },
      watch: { type: "string" },
      "from-block": { type: "string" },
      out: { type: "string" },
      root: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  const [command, ...rest] = positionals;
  if (values.help || !command) {
    console.log(HELP);
    return command || values.help ? 0 : 2;
  }
  const root = values.root ? resolve(values.root) : findRoot(process.cwd());
  const log = (line: string) => console.error(line);

  switch (command) {
    case "check": {
      const address = rest[0];
      if (!address) throw new Error("check needs the node's address: lifeline check /dns4/<domain>/tcp/443/wss/p2p/<peer id>");
      const result = await check({ root, address, network: network(values.network), durationSec: Number(values.seconds ?? 180) });
      console.log(values.json ? JSON.stringify(result, null, 2) : describeCheck(result));
      return result.passed ? 0 : 1;
    }
    case "test": {
      const conditions = (values.conditions ?? "A,B,C").split(",").map((c) => c.trim().toUpperCase());
      for (const c of conditions) if (!(c in CONDITIONS)) throw new Error(`Unknown condition ${c}; known: ${Object.keys(CONDITIONS).join(", ")}`);
      if (values.watch && !values["from-block"]) throw new Error("--watch needs --from-block: the block before the address's first cell");
      const summary = await test({
        root,
        network: network(values.network),
        conditions: conditions as Condition[],
        trials: Number(values.trials ?? 10),
        durationSec: Number(values.seconds ?? 300),
        location: values.location ?? "local",
        extraNodes: values.node ?? [],
        watch: values.watch ? { address: values.watch, fromBlock: values["from-block"]! } : undefined,
        out: values.out,
        log,
      });
      for (const v of summary.verdicts) console.log(`${v.id} ${v.passed ? "PASS" : "FAIL"}  ${v.claim}: ${v.detail}`);
      console.log(`Raw results: ${summary.dir}`);
      return 0;
    }
    case "uptime": {
      const n = network(values.network);
      if (n === "devnet") throw new Error("uptime is for mainnet and testnet nodes");
      const { file, results } = await uptime({ root, network: n, out: values.out, log });
      console.log(`${results.filter((r) => r.passed).length}/${results.length} nodes passed; ${file}`);
      return 0;
    }
    default:
      console.error(`Unknown command ${command}\n\n${HELP}`);
      return 2;
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(2);
  },
);
