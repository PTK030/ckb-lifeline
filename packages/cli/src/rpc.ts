// A few calls to a full node's JSON-RPC, used as the reference a light
// client's view is compared with.

let nextId = 1;

export async function rpc<T>(url: string, method: string, params: unknown[] = [], timeoutMs = 15000): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`${url} ${method}: HTTP ${response.status}`);
  const body = (await response.json()) as { result?: T; error?: { message: string } };
  if (body.error) throw new Error(`${url} ${method}: ${body.error.message}`);
  return body.result as T;
}

export async function tipNumber(url: string): Promise<bigint> {
  return BigInt(await rpc<string>(url, "get_tip_block_number"));
}

export async function cellsCapacity(url: string, script: unknown): Promise<bigint> {
  const result = await rpc<{ capacity: string } | null>(url, "get_cells_capacity", [
    { script, script_type: "lock", script_search_mode: "exact" },
  ]);
  return BigInt(result?.capacity ?? "0x0");
}

export async function transactionStatus(url: string, hash: string): Promise<string | undefined> {
  const result = await rpc<{ tx_status: { status: string } } | null>(url, "get_transaction", [hash]);
  return result?.tx_status.status;
}
