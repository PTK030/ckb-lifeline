# Development

How the repository fits together, how to run each part, and the few things
that are easy to get wrong.

## Layout

| Path | What it is |
|---|---|
| `node/` | The node recipe: `compose.yaml` (CKB, Nginx, certbot), the CKB entrypoint, the Nginx template and the public RPC filter, server scripts. What runs on a server. |
| `devnet/` | Four nodes of a local dev chain behind the same recipe, a miner, and `up.mjs`/`down.mjs`. What runs on your computer. |
| `packages/probe` | The probe page (the official light client, bundled) and its Playwright driver. |
| `packages/cli` | `lifeline`: `check`, `test`, `verify`, `uptime`; the thresholds in `verdict.ts`. |
| `nodes/` | Independent nodes, per network, for apps to build in. |
| `data/` | Raw test results (`results/`). The hourly uptime log lives on the `uptime-data` branch. |
| `docker/` | The image with the tools and a browser. |
| `docs/` | The recipe, the test protocol and how-tos, this file among them. |

## Setup

- Node.js: the version in `.nvmrc` (22 or newer works). npm 11 or newer:
  npm 10 fails to install this workspace (`npx npm@11 ci` if yours is older).
- Docker with Compose, for the node and the devnet.
- Chromium for Playwright: `npx playwright install chromium`.

```bash
npm ci                   # also installs the git hooks (lefthook)
npm run build            # probe page, probe, cli
npm test                 # unit tests
npm run devnet:up        # four nodes and a miner; writes devnet/data/lifeline.json
npx lifeline check --network devnet /dns4/a.lifeline.test/tcp/4433/wss/p2p/<id>
npx lifeline test --network devnet --conditions A,B,C,E,F --trials 2 --seconds 120
npm run devnet:down      # --wipe to start the chain over
```

`npm run devnet:up` prints each node's address; `devnet/data/lifeline.json`
has them too.

## Checks

CI runs these on every pull request (`.github/workflows/ci.yml`);
`npm run check` runs the first three:

```bash
npm run build && npm run typecheck
npm test
node .github/scripts/commit-subject.mjs --all
shellcheck node/ckb/entrypoint.sh node/nginx/40-lifeline.sh node/scripts/*.sh
docker compose -f node/compose.yaml config && docker compose -f devnet/compose.yaml config
```

CI also starts the devnet and runs `check` on every node and a short
kill-switch test against it.

## Things that are easy to get wrong

- **The light client needs two peers.** With `max_outbound_peers = 4` it
  waits for 2 before it syncs. `check` sets it to 2, so one node is enough to
  judge that node; `test` keeps 4, as apps do.
- **Fresh browser per trial.** The light client remembers peers in the
  page's storage. `runProbe` starts a new Chromium every time; reusing one
  would let a trial find peers an earlier one learned.
- **Blocking happens in the browser.** `--host-resolver-rules` changes
  Chromium's resolver only. Do not "test" by editing the hosts file: that
  changes more than the one thing the test is about.
- **Cross-origin isolation.** The light client uses `SharedArrayBuffer`, so
  the probe page must be served with COOP and COEP headers
  (`packages/probe/src/server.ts`). Opened from `file://` it does not start.
- **`ckb.toml` is rewritten in part.** `node/ckb/entrypoint.sh` sets the keys
  it owns at every start (`set_toml`), and only those. Add a key there, not in
  a hand-edited `ckb.toml`, if the recipe should own it.
- **Nginx without a certificate.** In `letsencrypt` mode Nginx starts with
  port 80 only until the certificate exists. The full config is rendered on
  the next start (`scripts/certificate.sh` restarts it).
- **Git Bash on Windows** rewrites arguments that start with `/` into paths.
  Set `MSYS_NO_PATHCONV=1` when passing a multiaddr.
- **Formatting.** No formatter runs over the whole tree; format what you write
  in the style of the file around it.
