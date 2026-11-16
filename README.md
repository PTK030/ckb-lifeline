<p align="center">
  <img src="docs/images/icon.png" width="80" height="80" alt="ckb-lifeline">
</p>

<h1 align="center">ckb-lifeline</h1>

<p align="center">
  <b>English</b> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.pl.md">Polski</a>
</p>

<p align="center">
  <b>More than one way in.</b><br>
  Independent CKB nodes for light clients in the browser, a recipe to run one in an afternoon, and a test that shows what happens without them.
</p>

<p align="center">
  <a href="docs/node-recipe.md"><b>Run a node</b></a> ·
  <a href="docs/verify.md"><b>Verify</b></a> ·
  <a href="docs/test-protocol.md"><b>Test protocol</b></a> ·
  <a href="docs/rpc.md"><b>Public RPC</b></a> ·
  <a href="CHANGELOG.md"><b>Changelog</b></a> ·
  <a href="CONTRIBUTING.md"><b>Contributing</b></a>
</p>

<p align="center">
  <a href="CHANGELOG.md"><img src="https://img.shields.io/badge/version-0.1.0-3cc68a?style=for-the-badge&labelColor=0d1117" alt="Version 0.1.0"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-3cc68a?style=for-the-badge&labelColor=0d1117" alt="License: MIT"></a>
  <a href="https://github.com/nervosnetwork/ckb/releases/tag/v0.210.0"><img src="https://img.shields.io/badge/ckb-v0.210.0-3cc68a?style=for-the-badge&labelColor=0d1117" alt="CKB v0.210.0"></a>
</p>

<p align="center">
  <img src="docs/images/demo.webp" alt="A browser wallet connected to many nodes that all sit behind one domain; the domain goes away and the wallet goes dark; independent nodes appear from other directions and the wallet lights up again" width="100%">
</p>

A wallet that runs the CKB light client in the browser cannot talk to the network the way a full node does. A web page can only open WebSocket connections over TLS, to a domain name: `/dns4/<domain>/tcp/443/wss/p2p/<peer id>`. And it waits for two such peers before it syncs.

Today every address published for that purpose, 26 on mainnet and 12 on testnet, sits under one domain: `*.ckb.guide`. Apps copy that list. If the one domain stops answering, for an hour or for good, every one of those apps loses the network at the same time.

ckb-lifeline is the other half: more nodes, run by more people, that a browser can reach.

- **A node recipe.** One `docker compose up -d` on a small server: the official CKB image, Nginx on port 443 (WSS for browsers, plain P2P for other nodes), a certificate that renews itself. [From an empty server](docs/node-recipe.md) in about an hour.
- **A check with the real thing.** `lifeline check` starts the official light client in Chromium with your node as its only peer and tells you whether a wallet could use it.
- **A test anyone can repeat.** `lifeline test` blocks `*.ckb.guide` in the browser, and only there, and measures what a light client does with and without independent nodes. Every trial is kept, raw.
- **A list for apps.** `nodes/` holds nodes that passed the check, for apps to build in next to the usual list. Nothing is fetched at run time.
- **An optional public RPC.** The same node can answer JSON-RPC for the read methods and `send_transaction`, [behind a filter and limits](docs/rpc.md). Off unless you turn it on.

## What happens today

Measured on 16 November 2026 with the official light client (`@nervosnetwork/ckb-light-client-js` 0.5.5) in Chromium, starting from the 26 mainnet addresses apps ship today, 10 trials each. Raw data: [data/results/2026-11-16-mainnet-eu-1](data/results/2026-11-16-mainnet-eu-1).

| | `*.ckb.guide` | Synced | Peers | Time to sync (median) |
|---|---|---|---|---|
| **A** | answers | 10 of 10 | 2 after 2.7 s | 10.7 s |
| **B** | does not answer | 0 of 10 | 0 for the whole 300 s | never |

With the one domain gone, a light client in the browser does not get a single peer. The test only changed the browser's own resolver; everything else was the same.

On the local devnet, where two nodes stand in for the usual peers and two for independent ones ([data](data/results/2026-11-16-devnet-local-devnet)), the independent nodes bring the client back: transfers sent through it were committed in 9 to 10 s, and the balance it read matched a full node's. It reached its second peer only after about 60 s, though, because it spends its first attempts on the addresses that are gone. Mainnet runs with independent nodes, and from a second location, follow as the nodes go up.

## Why I'm building it

A light client is supposed to be the way to use a chain without trusting someone else's server. In the browser, it still starts from somebody's list of servers, and today that list has one name on it.

Nobody did anything wrong here. Somebody had to run the first WSS nodes, and they did, for free. What is missing is a second operator, and a third. That costs a small server and an afternoon. So I am running nodes, writing down how, and testing in the open whether it makes a difference.

## How it works

| | Without independent nodes | With them |
|---|---|---|
| **Start list** | 26 addresses under `*.ckb.guide` | the same 26, and the nodes in `nodes/mainnet.json` |
| **`*.ckb.guide` answers** | the light client syncs | it syncs, from more operators |
| **`*.ckb.guide` does not** | no peers, nothing loads | it syncs from the independent nodes |

The list is copied into an app when it is built. A node in it cannot redirect anyone: the light client verifies headers and proofs itself, and a node can at most withhold data, which is what having more of them guards against.

## Getting started

### Run a node

```bash
git clone https://github.com/PTK030/ckb-lifeline
cd ckb-lifeline
sudo sh node/scripts/setup-vps.sh
cp node/.env.example node/.env     # your domain, mainnet or testnet
cd node && docker compose up -d
sh scripts/certificate.sh
```

The whole walk-through, with what to check after each step: [docs/node-recipe.md](docs/node-recipe.md).

### Try everything locally

Requires Node.js 22+ (npm 11), Docker and Chromium for Playwright.

```bash
npm ci && npx playwright install chromium && npm run build
npm run devnet:up                 # four nodes of a local chain and a miner
npx lifeline test --network devnet --conditions A,B,C,F --trials 2 --seconds 120
npm run devnet:down
```

The devnet runs the same entrypoint and the same Nginx config as a server; two of its nodes stand in for the usual peers, two for independent ones. [docs/deploy-mainnet.md](docs/deploy-mainnet.md) is the checklist for moving to testnet and mainnet.

### Check a node, or test the network

```bash
npx lifeline check /dns4/ckb1.example.org/tcp/443/wss/p2p/Qm...
npx lifeline verify --network mainnet        # one trial of B and of C, ~5 minutes
npx lifeline test --network mainnet --conditions A,B --trials 10 --location <where you are>
```

Or without Node.js: `docker run --rm ghcr.io/ptk030/lifeline-test verify --network mainnet`.

## Independent nodes

| Network | Address | Operator |
|---|---|---|
| | *None listed yet.* [Run one](docs/node-recipe.md) and open a pull request. | |

## Repository

| Path | |
|---|---|
| `node/` | The recipe: compose file, CKB entrypoint, Nginx, the RPC filter, server scripts |
| `devnet/` | The local four-node chain |
| `packages/probe` | The light client in a browser page, and the driver that runs it |
| `packages/cli` | `lifeline`: check, test, verify, uptime |
| `nodes/` | Independent nodes per network |
| `data/results/` | Raw results of every test run |
| `docs/` | Recipe, test protocol, verification, development |

[docs/development.md](docs/development.md) explains how the parts fit and what is easy to get wrong.

## License

[MIT](LICENSE).
