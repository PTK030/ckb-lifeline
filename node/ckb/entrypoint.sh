#!/bin/sh
# Starts a CKB full node that light clients in browsers can reach over WSS.
#
# The first start runs `ckb init` for $CKB_NETWORK and makes the node's network
# key. Every start writes the settings this recipe owns into ckb.toml again, so
# changing .env and restarting the container is enough to apply them. Anything
# else in ckb.toml is left as `ckb init` wrote it, or as you changed it.
set -eu

: "${CKB_NETWORK:=mainnet}"   # mainnet | testnet | dev
: "${CKB_P2P_PORT:=8115}"
: "${CKB_RPC_PORT:=8114}"
: "${PUBLIC_HOST:=}"          # the node's domain, e.g. ckb1.example.org
: "${PUBLIC_PORT:=443}"       # where Nginx takes WSS and TCP for this node
: "${CKB_RPC_MODULES:=Net,Pool,Chain,Stats}"
: "${CKB_INDEXER:=false}"      # true adds the built-in indexer (public RPC wants it)
: "${CKB_RPC_BATCH_LIMIT:=20}"
: "${CKB_LOG:=info}"
: "${CKB_SPEC_FILE:=}"        # dev chains: the spec every node of the chain shares
: "${CKB_BA_ARG:=}"           # dev chains: lock args that mined blocks pay to
: "${LIFELINE_SHARE:=}"       # devnet: a directory where nodes leave their address
: "${LIFELINE_NAME:=}"        # devnet: this node's name on the internal network
: "${LIFELINE_BOOTNODES:=}"   # devnet: names of nodes to start from, space separated

cd /var/lib/ckb
KEY=data/network/secret_key

log() { echo "lifeline: $*"; }

# set SECTION KEY VALUE: writes `KEY = VALUE` into [SECTION] of ckb.toml,
# replacing the line or its commented-out example, or adding it to the section.
set_toml() {
  awk -v section="[$1]" -v key="$2" -v value="$3" '
    function flush() { if (in_section && !done) { print key " = " value; done = 1 } }
    /^\[/ { flush(); in_section = ($0 == section) }
    in_section && !done && ($0 ~ "^#? ?" key " *=") { print key " = " value; done = 1; next }
    { print }
    END { flush() }
  ' ckb.toml > ckb.toml.next
  mv ckb.toml.next ckb.toml
}

# "Net,Pool" -> ["Net", "Pool"]
toml_list() {
  echo "$1" | awk -F, '{ printf "["; for (i = 1; i <= NF; i++) { gsub(/^ +| +$/, "", $i); printf "%s\"%s\"", (i > 1 ? ", " : ""), $i } printf "]" }'
}

if [ ! -f ckb.toml ]; then
  log "first start: initialising a $CKB_NETWORK node"
  if [ "$CKB_NETWORK" = dev ] && [ -n "$CKB_BA_ARG" ]; then
    ckb init --chain dev --ba-arg "$CKB_BA_ARG" --p2p-port "$CKB_P2P_PORT" --rpc-port "$CKB_RPC_PORT"
  else
    ckb init --chain "$CKB_NETWORK" --p2p-port "$CKB_P2P_PORT" --rpc-port "$CKB_RPC_PORT"
  fi
fi

# A dev chain is only one chain if every node starts from the same spec.
if [ "$CKB_NETWORK" = dev ] && [ -n "$CKB_SPEC_FILE" ]; then
  cp "$CKB_SPEC_FILE" specs/dev.toml
fi

if [ ! -f "$KEY" ]; then
  mkdir -p "$(dirname "$KEY")"
  ckb peer-id gen --secret-path "$KEY"
  log "made a new network key: back up $KEY, it is this node's identity"
fi
PEER_ID=$(ckb peer-id from-secret --secret-path "$KEY" | grep -o 'Qm[1-9A-HJ-NP-Za-km-z]*' | head -n 1)

set_toml logger filter "\"$CKB_LOG\""
set_toml logger log_to_file false
set_toml logger log_to_stdout true
set_toml network listen_addresses "[\"/ip4/0.0.0.0/tcp/$CKB_P2P_PORT\"]"
set_toml network reuse_tcp_with_ws true
if [ -n "$PUBLIC_HOST" ]; then
  set_toml network public_addresses "[\"/dns4/$PUBLIC_HOST/tcp/$PUBLIC_PORT\"]"
fi
set_toml rpc listen_address "\"0.0.0.0:$CKB_RPC_PORT\""
modules="$CKB_RPC_MODULES"
if [ "$CKB_INDEXER" = true ] && ! echo "$modules" | grep -q Indexer; then
  modules="$modules,Indexer"
fi
set_toml rpc modules "$(toml_list "$modules")"
set_toml rpc rpc_batch_limit "$CKB_RPC_BATCH_LIMIT"
if [ "$CKB_NETWORK" = dev ] && [ -n "$CKB_BA_ARG" ] && grep -q '^\[block_assembler\]' ckb.toml; then
  set_toml block_assembler args "\"$CKB_BA_ARG\""
fi

if [ -n "$LIFELINE_SHARE" ] && [ -n "$LIFELINE_NAME" ]; then
  echo "/dns4/$LIFELINE_NAME/tcp/$CKB_P2P_PORT/p2p/$PEER_ID" > "$LIFELINE_SHARE/$LIFELINE_NAME.addr"
fi
if [ -n "$LIFELINE_BOOTNODES" ]; then
  list=""
  for name in $LIFELINE_BOOTNODES; do
    [ "$name" = "$LIFELINE_NAME" ] && continue
    file="$LIFELINE_SHARE/$name.addr"
    tries=0
    until [ -f "$file" ] || [ "$tries" -ge 60 ]; do sleep 1; tries=$((tries + 1)); done
    [ -f "$file" ] && list="$list${list:+, }\"$(cat "$file")\""
  done
  set_toml network bootnodes "[$list]"
fi

if [ -n "$PUBLIC_HOST" ]; then
  address="/dns4/$PUBLIC_HOST/tcp/$PUBLIC_PORT/wss/p2p/$PEER_ID"
  echo "$address" > lifeline-address.txt
  log "light clients reach this node at $address"
fi
log "peer id $PEER_ID"

exec ckb run "$@"
