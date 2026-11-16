#!/bin/sh
# Copies the node's network key out of its volume. The key is the node's
# identity: the peer id in its address comes from it. Lose it and every app
# that lists your address has to be updated; leak it and someone else can
# answer as your node. Keep the copy somewhere safe and off this server.
#
#   sh node/scripts/backup-key.sh [destination]
set -eu
cd "$(dirname "$0")/.."
dest="${1:-./secret_key.backup}"
umask 077
docker compose cp ckb:/var/lib/ckb/data/network/secret_key "$dest"
chmod 600 "$dest"
echo "Saved to $dest. To restore on a new server, copy it to"
echo "/var/lib/ckb/data/network/secret_key in the ckb volume before the first start."
