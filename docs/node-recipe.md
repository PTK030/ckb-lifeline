# Run a node for browser light clients

From an empty server to a node that `lifeline check` passes. Plan on about an
hour of your time; the first sync of the chain then runs on its own.

## What you need

- A server with a public IPv4 address: 4 CPU cores, 8 GB of memory and an SSD
  with room for the chain (mainnet is a few hundred GB and grows; check the
  current size before you buy) run it comfortably. Ubuntu 24.04 or Debian 12.
- A domain, or a subdomain, whose DNS you control.
- Ports 80, 443 and 8115 open to the world.

One domain per node: the domain is in the node's address, and apps build that
address in.

## 1. Point the domain at the server

Add an A record (and AAAA, if the server has IPv6) for the node's name, e.g.
`ckb1.example.org`, pointing at the server. Let's Encrypt checks it in step 4.

## 2. Prepare the server

```bash
git clone https://github.com/PTK030/ckb-lifeline
cd ckb-lifeline
sudo sh node/scripts/setup-vps.sh
```

The script installs Docker from the distribution's packages and opens SSH,
80, 443 and 8115 in the firewall. Log out and back in afterwards so that your
user can run `docker`.

## 3. Configure and start

```bash
cp node/.env.example node/.env
nano node/.env            # DOMAIN, ACME_EMAIL, CKB_NETWORK
cd node && docker compose up -d
```

On the first start the node runs `ckb init`, makes its network key and prints
the address light clients will use:

```bash
docker compose logs ckb | grep "light clients reach"
# lifeline: light clients reach this node at /dns4/ckb1.example.org/tcp/443/wss/p2p/Qm...
```

The node now syncs the chain. On mainnet that takes a day or more, depending
on the disk; `docker compose logs -f ckb` shows the progress.

Back up the network key now: it is the node's identity, and the peer id in its
address comes from it. `sh scripts/backup-key.sh` copies it out of the volume;
keep the copy off the server.

## 4. Get the certificate

```bash
sh scripts/certificate.sh
```

Until this has run, Nginx serves only port 80, for the challenge. Afterwards it
serves port 443: TLS connections (browsers) are turned into the node's
WebSocket, and anything else (other full nodes) goes to the node as plain P2P.
certbot renews the certificate in the background and Nginx picks the new one
up twice a day.

## 5. Check it

From any computer with Node.js 22+ and a clone of this repository (or with
Docker, see [verify.md](verify.md)):

```bash
npm ci && npx playwright install chromium && npm run build
npx lifeline check /dns4/ckb1.example.org/tcp/443/wss/p2p/Qm...
```

On Windows in Git Bash, put `MSYS_NO_PATHCONV=1` in front, or Git Bash turns
the address into a file path.

`check` starts the CKB light client in Chromium with your node as its only
peer and with every other domain unresolvable. It passes when the client
connects, your node offers the LightClient and Filter protocols, and the
client's tip comes within 3 blocks of a reference node. Until the node has
synced, the last part fails; that is expected.

## 6. Tell apps about it

Once `check` passes on a synced node, add it to `nodes/mainnet.json` (or
`testnet.json`) in a pull request:

```json
{ "address": "/dns4/ckb1.example.org/tcp/443/wss/p2p/Qm...", "operator": "your name or handle", "location": "city, country", "since": "2026-11-16" }
```

Apps copy the list into their build. Nothing fetches it at run time, so a
listed node can never be used to change what an app connects to.

## Keeping it running

| Task | How |
|---|---|
| See what it does | `docker compose logs -f ckb` and `docker compose logs -f nginx` |
| Update CKB | set the new `CKB_IMAGE` in `.env`, then `docker compose up -d` |
| Restart | `docker compose restart` |
| Stop | `docker compose down` (the chain and the key stay in the volume) |
| Move to a new server | restore the key (`scripts/backup-key.sh` explains where) before the first start, then point DNS at the new server |

The settings this recipe manages in `ckb.toml` (listen and public addresses,
RPC modules, logging) are written again at every start from `.env`. Anything
else you change in `ckb.toml` stays as you left it:
`docker compose exec ckb sh -c 'vi /var/lib/ckb/ckb.toml'`, then restart.

## Behind it

- [ckb.toml](https://docs.nervos.org/docs/node/node-configuration): CKB
  accepts WebSocket on its P2P port (`reuse_tcp_with_ws`) and advertises
  `public_addresses`; `node/ckb/entrypoint.sh` sets both.
- `node/nginx/nginx.conf.template`: the stream server on 443 reads the first
  bytes of each connection (`ssl_preread`) and sends TLS to the WebSocket
  server and everything else to the node. This is the layout the CKB
  documentation describes for WSS.
- The node's JSON-RPC is not published; Nginx can expose a filtered part of
  it, see [rpc.md](rpc.md).
