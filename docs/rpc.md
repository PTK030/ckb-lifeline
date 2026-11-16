# Public JSON-RPC (optional)

The same node can also answer JSON-RPC at `https://<domain>/rpc`, for apps
that talk to a full node instead of running a light client. It is off by
default; set `RPC_PUBLIC=true` in `node/.env` and run `docker compose up -d`.

```bash
curl -s https://ckb1.example.org/rpc -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_tip_block_number","params":[]}'
```

## What is open

The node's RPC port itself stays on the internal Docker network. Nginx takes
requests on `/rpc` and `node/nginx/rpc.js` passes on only:

- reading the chain: blocks, headers, transactions, live cells, epochs,
  proofs, block filters, consensus and fee statistics;
- the built-in indexer: `get_cells`, `get_transactions`,
  `get_cells_capacity`, `get_indexer_tip` (turning the RPC on also turns the
  indexer on);
- `send_transaction`, `estimate_cycles`, `tx_pool_info`.

Everything else (`clear_tx_pool`, `remove_transaction`, peer management,
mining, debugging) is refused with a JSON-RPC error before it reaches the
node. `node/test/rpc.test.ts` checks the list.

## Limits

| Setting | Default | |
|---|---|---|
| `RPC_RATE` | `10r/s` | requests per second per IP |
| `RPC_BURST` | `20` | requests above the rate that are queued before 429 |
| batch size | 20 | requests in one JSON-RPC batch |
| body size | 64 KB | per request |

Browsers can call it from any origin (CORS is open), since the RPC is public
anyway.

## What it costs

- **Disk and CPU.** The indexer adds to the node's database and work.
- **Traffic.** `get_block` and `get_transactions` answers can be large. Watch
  the server's bandwidth for the first weeks.
- **Responsibility.** Apps that start using your endpoint depend on it. Turn it
  on when you mean to keep it on, and say so where you list it.

A light client in the browser does not need any of this: it uses the WSS
side of the node, which is always on.
