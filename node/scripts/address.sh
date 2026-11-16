#!/bin/sh
# Prints the address light clients use to reach this node:
#   /dns4/<domain>/tcp/443/wss/p2p/<peer id>
set -eu
cd "$(dirname "$0")/.."
docker compose exec -T ckb cat /var/lib/ckb/lifeline-address.txt
