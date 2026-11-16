// What the driver asks the page to do, and what the page reports back.
// Shared by the page (in the browser) and the driver (in Node).

export type Network = "mainnet" | "testnet" | "devnet";

export interface ProbeRequest {
  network: Network;
  /** Peers the light client starts from: /dns4/<host>/tcp/<port>/wss/p2p/<id> */
  bootnodes: string[];
  /**
   * The light client starts syncing once it has max_outbound_peers / 2 peers.
   * Apps use 4 (so 2 peers); checking a single node uses 2 (so 1 peer).
   */
  maxOutboundPeers: number;
  /** Devnet only: the chain spec the nodes run (TOML). */
  devnetSpec?: string;
  /** A lock script whose capacity to read once synced (JSON-RPC form). */
  watch?: { script: JsonScript; fromBlock: string };
  /** A signed transaction to send through the light client (JSON-RPC form). */
  sendTransaction?: unknown;
  /** How often the page samples peers and tip, in milliseconds. */
  sampleEveryMs: number;
}

export interface JsonScript {
  code_hash: string;
  hash_type: "type" | "data" | "data1" | "data2";
  args: string;
}

export interface PeerSample {
  nodeId: string;
  addresses: string[];
  protocols: number[];
  /** The best header this peer has proved to us, if any. */
  provedTip?: string;
}

export interface Sample {
  /** Milliseconds since the light client was asked to start. */
  t: number;
  peers: PeerSample[];
  /** Our tip block number (decimal string), or undefined before the first header. */
  tip?: string;
}

export type ProbeEvent =
  | { kind: "started"; t: number }
  | { kind: "sample"; sample: Sample }
  | { kind: "capacity"; t: number; capacity: string; tip: string }
  | { kind: "sent"; t: number; txHash: string }
  | { kind: "error"; t: number; message: string };

/** Console lines carrying events start with this, followed by JSON. */
export const EVENT_PREFIX = "LIFELINE ";
