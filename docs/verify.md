# See it for yourself

Three ways to check the claim of this repository, from five minutes to an
afternoon. None needs reading the code.

## 1. One command (about 5 minutes)

```bash
docker run --rm ghcr.io/ptk030/lifeline-test verify --network mainnet
```

or, with Node.js 22+ and a clone of this repository:

```bash
npm ci && npx playwright install chromium && npm run build
npx lifeline verify --network mainnet
```

It runs the official light client in Chromium twice:

```
B  usual peers blocked:                     FAIL  0 peers after 120 s, no sync
C  usual peers blocked, independent added:  PASS  4 peers, synced in 14 s, tip … (reference …)
```

B blocks `*.ckb.guide` in the browser's own resolver and starts from the peer
list apps use today. C does the same and adds the independent nodes from
`nodes/mainnet.json`. Your computer's DNS is not touched.

While `nodes/mainnet.json` lists no node yet, C is skipped and the output says
so. To see C anyway, give it a node with `--node <address>`, or run it on the
local devnet (`npm run devnet:up`, then `npx lifeline verify --network devnet`).

## 2. In your own browser (about 3 minutes)

1. `npm run build`, then serve `packages/probe/dist/page/` with the two headers
   the light client needs (`Cross-Origin-Opener-Policy: same-origin` and
   `Cross-Origin-Embedder-Policy: require-corp`). The probe's own server does
   that: `node -e "import('./packages/probe/dist/server.js').then(async m => console.log((await m.servePage()).url))"`.
2. Block `*.ckb.guide` in your browser, for example by starting Chrome with
   `--host-resolver-rules="MAP *.ckb.guide ~NOTFOUND"`.
3. Open the page, paste the addresses from `nodes/mainnet.json`, press Start.
   The page shows the peers and the tip as they come in.

## 3. The full data

- `data/results/`: every trial of every run, raw (`trials.csv`,
  `samples.jsonl`) and summed up (`summary.md`). The thresholds they are
  judged by are in [test-protocol.md](test-protocol.md), written before the
  first run.
- The `uptime-data` branch: an hourly row per listed node since it was added.

To run the whole protocol yourself:

```bash
npx lifeline test --network mainnet --conditions A,B,C,E --trials 10 --location <where you are>
```
