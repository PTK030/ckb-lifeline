import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Network } from "@ckb-lifeline/probe";
import reference from "./data/reference-peers.json" with { type: "json" };
import { parseWssAddress } from "./multiaddr.js";

/** Everything a test needs to know about one network. */
export interface NetworkProfile {
  network: Network;
  /** The peers apps ship with today. */
  reference: string[];
  /** Host pattern that takes all of the reference peers away. */
  referencePattern: string;
  /** Independent peers: nodes/<network>.json, or the devnet's own. */
  independent: string[];
  /** A full node's JSON-RPC to compare the tip, balances and transactions with. */
  referenceRpc: string;
  /** Devnet only. */
  devnetSpec?: string;
  map?: Record<string, string>;
  insecureTls?: boolean;
}

const REFERENCE_RPC: Record<"mainnet" | "testnet", string> = {
  mainnet: "https://mainnet.ckb.dev/rpc",
  testnet: "https://testnet.ckb.dev/rpc",
};

export interface NodeEntry {
  address: string;
  operator?: string;
  location?: string;
  since?: string;
}

/** Reads nodes/<network>.json: the independent nodes this repository lists. */
export function readNodeList(root: string, network: "mainnet" | "testnet"): NodeEntry[] {
  const file = resolve(root, "nodes", `${network}.json`);
  const list = JSON.parse(readFileSync(file, "utf8")) as { nodes: NodeEntry[] };
  for (const node of list.nodes) parseWssAddress(node.address);
  return list.nodes;
}

/** What `devnet/up` leaves in devnet/data/lifeline.json for the tools. */
export interface DevnetDescription {
  spec: string;
  rpc: string;
  guide: string[];
  independent: string[];
  map: Record<string, string>;
  referencePattern: string;
}

export function loadProfile(root: string, network: Network, extra: string[] = []): NetworkProfile {
  if (network === "devnet") {
    const file = resolve(root, "devnet", "data", "lifeline.json");
    let devnet: DevnetDescription;
    try {
      devnet = JSON.parse(readFileSync(file, "utf8")) as DevnetDescription;
    } catch {
      throw new Error(`No running devnet described in ${file}. Start it first: npm run devnet:up`);
    }
    return {
      network,
      reference: devnet.guide,
      referencePattern: devnet.referencePattern,
      independent: [...devnet.independent, ...extra],
      referenceRpc: devnet.rpc,
      devnetSpec: readFileSync(resolve(root, "devnet", devnet.spec), "utf8"),
      map: devnet.map,
      insecureTls: true,
    };
  }
  return {
    network,
    reference: reference[network],
    referencePattern: "*.ckb.guide",
    independent: [...readNodeList(root, network).map((n) => n.address), ...extra],
    referenceRpc: REFERENCE_RPC[network],
  };
}
