# Changelog

What changed in each version, newest first, in words for node operators and
app developers.

## 0.1.0

The first version: a node recipe, the tools to check it, and a test of what a
browser light client does when its usual peers are gone.

### Node recipe

- One `docker compose up -d` runs a CKB full node (the official image), Nginx
  on port 443 and certbot. Browsers reach the node over WSS on 443; other full
  nodes reach it over plain P2P on the same port and on 8115.
- The node advertises its `/dns4/<domain>/tcp/443` address, and prints the
  full address light clients use.
- Until the first certificate is issued, only port 80 answers, for the
  challenge; `scripts/certificate.sh` issues it and switches to the full
  configuration. Renewal is automatic.
- Scripts for a fresh Ubuntu or Debian server, for the certificate and for
  backing up the node's network key.
- An optional public JSON-RPC at `/rpc`: read methods, the indexer and
  `send_transaction` only, limited per IP. Off by default.

### Tools

- `lifeline check <address>`: the real light client in Chromium, with only
  that node as a peer and every other domain unresolvable. Passes when it
  connects, the node speaks the light client protocols, and the tip comes
  within 3 blocks of a reference node.
- `lifeline test`: conditions A (usual peers), B (usual peers blocked), C
  (blocked, independent nodes added), E (one independent node fewer) and F
  (a transfer sent through the light client), any number of trials, raw
  results in `data/results/`.
- `lifeline verify`: one trial of B and one of C, in about five minutes.
  Until independent nodes are listed for a network, it runs B and says where
  to see C (`--node`, or the devnet).
- `lifeline watch`: the light client in a visible browser, with a line every
  2 seconds naming the nodes it is connected to; stop nodes meanwhile to see
  what an app sees.
- `lifeline uptime`: an hourly check of the nodes in `nodes/`, run by a
  workflow, logged on the `uptime-data` branch.
- A browser page to run the light client by hand with a list of your own.
  Every start begins with empty storage, so no peer from an earlier run or
  another network comes along, and addresses are checked before it starts.
- A container image with the tools and a browser.

### Devnet

- `npm run devnet:up` starts four nodes of a local dev chain behind the same
  recipe, two standing in for the usual peers and two for independent nodes,
  and a miner that makes a block about every 8 seconds, as on mainnet.
  Everything above works against it.
