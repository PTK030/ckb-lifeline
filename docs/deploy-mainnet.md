# From the devnet to mainnet

Everything in this repository runs locally first, on a devnet, and moves to a
real network by changing settings, not code. This is the checklist for that
move.

## What is the same

The devnet starts four nodes with the same files a server uses:
`node/ckb/entrypoint.sh` and `node/nginx/`. If `npm run devnet:up` works and
`lifeline check --network devnet` passes for its nodes, the recipe works; what
changes on a server is the network, the domain and the certificate.

| | Devnet (your computer) | Server |
|---|---|---|
| Compose file | `devnet/compose.yaml` | `node/compose.yaml` |
| Chain | `dev`, spec in `devnet/specs/dev.toml` | `CKB_NETWORK=mainnet` or `testnet` in `node/.env` |
| Name | `*.guide.test`, `*.lifeline.test`, mapped by the tools | your domain, in DNS |
| Certificate | self-signed (`devnet/certs/`), `TLS_MODE=files` | Let's Encrypt, `TLS_MODE=letsencrypt` |
| Ports | 127.0.0.1:4431 to 4434 | 443 (and 80, 8115) |
| Node RPC | 127.0.0.1:8114, all modules the miner needs | not published; optional filtered `/rpc` |

## Checklist

1. **Testnet first.** Run [node-recipe.md](node-recipe.md) with
   `CKB_NETWORK=testnet` on a small server. Testnet syncs faster and nothing on
   it is worth anything.
2. `npx lifeline check --network testnet <address>` passes once synced.
3. Add the node to `nodes/testnet.json` and run the full test there:
   `npx lifeline test --network testnet --conditions A,B,C,E,F` (F needs a
   funded testnet key in `LIFELINE_TX_KEY`).
4. **Mainnet.** A second server and a second domain; `CKB_NETWORK=mainnet`.
   Mainnet needs more disk, see the recipe.
5. `npx lifeline check <address>` passes once synced; add it to
   `nodes/mainnet.json`.
6. With two mainnet nodes listed, `npx lifeline test --network mainnet
   --conditions C,E --trials 10` shows whether they bring a light client back
   when the usual peers are gone.
7. The uptime workflow starts checking the listed nodes every hour on its own.

## Before you rely on it

- Two operators are better than two servers of one operator. A node run by
  someone else, from the same recipe, is what makes the list independent.
- The key backup (`node/scripts/backup-key.sh`) is the one thing you cannot
  recreate. Keep it off the server.
- Keep `CKB_IMAGE` current. A node on an old version can fall off the network
  at a hard fork.
