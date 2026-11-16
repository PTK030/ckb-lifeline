import { describe, expect, it } from "vitest";
// @ts-expect-error plain JavaScript run by Nginx's njs
import rpc from "../nginx/rpc.js";

interface Reply {
  status: number;
  body: { error?: { code: number; message: string }; result?: unknown };
}

/** A stand-in for the njs request object, enough for rpc.js. */
async function call(method: string, body: unknown): Promise<{ reply: Reply; forwarded?: string }> {
  let reply: Reply | undefined;
  let forwarded: string | undefined;
  const r = {
    method,
    requestText: typeof body === "string" ? body : JSON.stringify(body),
    headersOut: {} as Record<string, string>,
    return(status: number, text: string) {
      reply = { status, body: JSON.parse(text) };
    },
    async subrequest(_uri: string, options: { body: string }) {
      forwarded = options.body;
      return { status: 200, responseText: JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x10" }) };
    },
  };
  await rpc.handle(r);
  return { reply: reply!, forwarded };
}

describe("public JSON-RPC filter", () => {
  it("passes reads and send_transaction to the node", async () => {
    for (const method of ["get_tip_block_number", "get_cells", "send_transaction"]) {
      const { reply, forwarded } = await call("POST", { jsonrpc: "2.0", id: 1, method, params: [] });
      expect(reply.status).toBe(200);
      expect(JSON.parse(forwarded!).method).toBe(method);
    }
  });

  it("refuses methods that change the node", async () => {
    for (const method of ["clear_tx_pool", "remove_transaction", "set_ban", "generate_block", "submit_block", "set_network_active"]) {
      const { reply, forwarded } = await call("POST", { jsonrpc: "2.0", id: 7, method, params: [] });
      expect(reply.status).toBe(403);
      expect(reply.body.error?.code).toBe(-32601);
      expect(forwarded).toBeUndefined();
    }
  });

  it("refuses a batch if any call in it is not allowed", async () => {
    const { reply, forwarded } = await call("POST", [
      { jsonrpc: "2.0", id: 1, method: "get_tip_header", params: [] },
      { jsonrpc: "2.0", id: 2, method: "clear_tx_pool", params: [] },
    ]);
    expect(reply.status).toBe(403);
    expect(forwarded).toBeUndefined();
  });

  it("limits batch size and rejects bad input", async () => {
    const big = Array.from({ length: 21 }, (_, id) => ({ jsonrpc: "2.0", id, method: "get_tip_header", params: [] }));
    expect((await call("POST", big)).reply.status).toBe(400);
    expect((await call("POST", "{not json")).reply.body.error?.code).toBe(-32700);
    expect((await call("GET", "")).reply.status).toBe(405);
  });

  it("allows no method that writes, mines or manages peers", () => {
    const risky = /^(clear|remove|set_|generate|submit|add_node|remove_node|ping_peers|sync_state|jemalloc|notify|subscribe)/;
    expect((rpc.ALLOWED as string[]).filter((m) => risky.test(m))).toEqual([]);
  });
});
