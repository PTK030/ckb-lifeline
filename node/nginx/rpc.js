// Public JSON-RPC in front of the node (RPC_PUBLIC=true), run by Nginx's njs.
//
// The node's own RPC also has methods that change it (clear_tx_pool,
// remove_transaction, set_ban, ...). Only the methods below are passed on:
// reading the chain, the built-in indexer, fee estimates and sending a
// transaction. Everything else is refused before it reaches the node.

const ALLOWED = [
  // Chain
  "get_block",
  "get_block_by_number",
  "get_block_hash",
  "get_header",
  "get_header_by_number",
  "get_block_filter",
  "get_tip_header",
  "get_tip_block_number",
  "get_current_epoch",
  "get_epoch_by_number",
  "get_transaction",
  "get_live_cell",
  "get_block_economic_state",
  "get_transaction_proof",
  "verify_transaction_proof",
  "get_transaction_and_witness_proof",
  "verify_transaction_and_witness_proof",
  "get_fork_block",
  "get_consensus",
  "get_block_median_time",
  "estimate_cycles",
  "get_fee_rate_statistics",
  "get_fee_rate_statics",
  // Pool
  "send_transaction",
  "tx_pool_info",
  "get_pool_tx_detail_info",
  "estimate_fee_rate",
  // Stats
  "get_blockchain_info",
  "get_deployments_info",
  // Indexer
  "get_indexer_tip",
  "get_cells",
  "get_transactions",
  "get_cells_capacity",
];

const MAX_BATCH = 20;

function error(r, status, id, code, message) {
  r.headersOut["Content-Type"] = "application/json";
  r.return(status, JSON.stringify({ jsonrpc: "2.0", id: id === undefined ? null : id, error: { code, message } }));
}

async function handle(r) {
  if (r.method !== "POST") {
    return error(r, 405, null, -32600, "Send a JSON-RPC request with POST");
  }

  let body;
  try {
    body = JSON.parse(r.requestText);
  } catch (e) {
    return error(r, 400, null, -32700, "Parse error");
  }

  const calls = Array.isArray(body) ? body : [body];
  if (calls.length === 0 || calls.length > MAX_BATCH) {
    return error(r, 400, null, -32600, `A batch holds 1 to ${MAX_BATCH} requests`);
  }
  // A plain loop: njs, the JavaScript inside Nginx, has no for...of.
  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    if (!call || typeof call.method !== "string" || !ALLOWED.includes(call.method)) {
      const name = call && typeof call.method === "string" ? call.method : "(none)";
      return error(r, 403, call && call.id, -32601, `Method ${name} is not available on this public endpoint`);
    }
  }

  const reply = await r.subrequest("/_ckb_rpc", { method: "POST", body: JSON.stringify(body) });
  r.headersOut["Content-Type"] = "application/json";
  r.return(reply.status, reply.responseText);
}

export default { handle, ALLOWED };
