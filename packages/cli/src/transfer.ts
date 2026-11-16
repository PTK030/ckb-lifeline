// A small signed transfer for the "send a transaction without the usual peers"
// test. It is built and signed here, against a full node, and then handed to
// the light client in the browser, which is what sends it.

import { ccc } from "@ckb-ccc/core";
import { cccA } from "@ckb-ccc/core/advanced";
import { rpc } from "./rpc.js";

/**
 * The private key behind the issued cells of every `ckb init --chain dev`
 * spec. It is published in the CKB documentation and holds nothing outside a
 * local devnet.
 */
export const DEVNET_KEY = "0xd00c06bfd800d27397002dca6fb0993d5ba6399b4238b2f29ee9deb97593d2bc";

interface JsonBlock {
  transactions: { hash: string; outputs: { type: { code_hash: string; hash_type: string; args: string } | null }[] }[];
}

/** A dev chain has the usual system scripts, but at its own genesis out points. */
async function devnetScripts(url: string) {
  const genesis = await rpc<JsonBlock>(url, "get_block_by_number", ["0x0"]);
  const [cellbase, depGroups] = genesis.transactions;
  const sighashType = cellbase?.outputs[1]?.type;
  if (!cellbase || !depGroups || !sighashType) throw new Error("unexpected dev chain genesis");
  const codeHash = ccc.Script.from({ codeHash: sighashType.code_hash, hashType: sighashType.hash_type as ccc.HashType, args: sighashType.args }).hash();
  return {
    ...cccA.TESTNET_SCRIPTS,
    [ccc.KnownScript.Secp256k1Blake160]: {
      codeHash,
      hashType: "type" as const,
      cellDeps: [{ cellDep: { outPoint: { txHash: depGroups.hash, index: 0 }, depType: "depGroup" as const } }],
    },
  };
}

export interface Transfer {
  hash: string;
  /** The transaction in the form the browser light client takes. */
  forLightClient: unknown;
  /**
   * The sender's lock and the block before its oldest input. A light client
   * checks a transaction against cells it knows before relaying it, so it has
   * to follow this lock from there first.
   */
  sender: { script: { code_hash: string; hash_type: ccc.HashType; args: string }; fromBlock: string };
}

/** Sends 100 CKB from the key's own address back to itself. */
export async function buildTransfer(network: "devnet" | "testnet", rpcUrl: string, key: string): Promise<Transfer> {
  const client =
    network === "devnet"
      ? new ccc.ClientPublicTestnet({ url: rpcUrl, scripts: await devnetScripts(rpcUrl) })
      : new ccc.ClientPublicTestnet({ url: rpcUrl });
  const signer = new ccc.SignerCkbPrivateKey(client, key);
  const { script: lock } = await signer.getRecommendedAddressObj();

  const tx = ccc.Transaction.from({ outputs: [{ lock, capacity: ccc.fixedPointFrom(100) }] });
  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, 1000);
  const signed = await signer.signTransaction(tx);

  let oldest: bigint | undefined;
  for (const input of signed.inputs) {
    const origin = await rpc<{ tx_status: { block_number: string | null } } | null>(rpcUrl, "get_transaction", [input.previousOutput.txHash]);
    const block = origin?.tx_status.block_number;
    if (block) oldest = oldest === undefined || BigInt(block) < oldest ? BigInt(block) : oldest;
  }
  const fromBlock = oldest === undefined || oldest === 0n ? 0n : oldest - 1n;

  return {
    hash: signed.hash(),
    forLightClient: toPlain(signed),
    sender: { script: { code_hash: lock.codeHash, hash_type: lock.hashType, args: lock.args }, fromBlock: fromBlock.toString() },
  };
}

/** bigint fields as hex, and nothing but the fields a transaction has. */
function toPlain(tx: ccc.Transaction): unknown {
  const hex = (n: bigint) => ccc.numToHex(n);
  const script = (s: ccc.Script) => ({ codeHash: s.codeHash, hashType: s.hashType, args: s.args });
  return {
    version: hex(tx.version),
    cellDeps: tx.cellDeps.map((d) => ({ outPoint: { txHash: d.outPoint.txHash, index: hex(d.outPoint.index) }, depType: d.depType })),
    headerDeps: tx.headerDeps,
    inputs: tx.inputs.map((i) => ({ previousOutput: { txHash: i.previousOutput.txHash, index: hex(i.previousOutput.index) }, since: hex(i.since) })),
    outputs: tx.outputs.map((o) => ({ capacity: hex(o.capacity), lock: script(o.lock), type: o.type ? script(o.type) : undefined })),
    outputsData: tx.outputsData,
    witnesses: tx.witnesses,
  };
}

/** The lock script of an address, in JSON-RPC form, for the balance check. */
export async function lockOf(address: string, network: "mainnet" | "testnet" | "devnet"): Promise<{ code_hash: string; hash_type: ccc.HashType; args: string }> {
  const client = network === "mainnet" ? new ccc.ClientPublicMainnet() : new ccc.ClientPublicTestnet();
  const { script } = await ccc.Address.fromString(address, client);
  return { code_hash: script.codeHash, hash_type: script.hashType, args: script.args };
}
