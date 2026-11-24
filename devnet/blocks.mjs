// Prints every new block of the local devnet as it arrives: the time, the
// number and how many transactions it holds. A block with only the miner's
// reward has 1; a transfer, for example from condition F, makes it 2.
//
//   npm run devnet:blocks      (node devnet/blocks.mjs, Ctrl+C to stop)
const RPC = process.env.DEVNET_RPC ?? "http://127.0.0.1:8114";

async function rpc(method, params = []) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = await res.json();
  if (body.error) throw new Error(body.error.message);
  return body.result;
}

let last = -1n;
let down = false;
for (;;) {
  try {
    const tip = BigInt(await rpc("get_tip_block_number"));
    if (down) console.log("devnet is back");
    down = false;
    for (let n = last < 0n ? tip : last + 1n; n <= tip; n++) {
      const block = await rpc("get_block_by_number", [`0x${n.toString(16)}`]);
      const time = new Date(Number(BigInt(block.header.timestamp))).toLocaleTimeString();
      const txs = block.transactions.length;
      console.log(`${time}  block ${n}  transactions ${txs}${txs > 1 ? "   <- a transfer" : ""}`);
    }
    last = tip;
  } catch {
    if (!down) console.log(`no answer from ${RPC}; is the devnet up? (npm run devnet:up)`);
    down = true;
  }
  await new Promise((r) => setTimeout(r, 2000));
}
