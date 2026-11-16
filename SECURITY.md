# Security

Light clients trust the nodes they start from to put them on the real
network. A flaw in the recipe, or in a listed node, can matter to every app
that builds the list in. Please report one privately.

## Reporting

Use [Report a vulnerability](https://github.com/PTK030/ckb-lifeline/security/advisories/new)
on GitHub. Say what you found, how to reproduce it and which version you
used. Never include a private key.

You will get an answer within a few days. A fix is released before the
details are made public, and you are credited unless you prefer not to be.

## In scope

- The node recipe exposing more than it should: the node's own RPC, a method
  the public RPC filter (`node/nginx/rpc.js`) should refuse, or anything else
  reachable from outside.
- A way to make a listed node serve a light client data of another chain, or
  to take over a listed node's identity.
- The tools reporting a pass for a node that does not work, or the reverse.
- Anything in this repository that makes an app fetch something at run time.

## How it is built to be safe

- **The node's RPC is private.** It listens only on the internal Docker
  network. The optional public `/rpc` passes an explicit list of read
  methods and `send_transaction`, with per-IP limits.
- **Light clients verify.** The light client checks proofs of work and
  headers itself; a node can withhold data, not forge it. Independent
  operators make withholding harder.
- **No run-time list.** `nodes/*.json` is copied into apps at build time.
- **Keys stay with operators.** Each node's network key is made on its own
  server; the recipe never sends it anywhere.
