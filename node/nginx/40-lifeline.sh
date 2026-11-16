#!/bin/sh
# Runs inside the official Nginx image before Nginx starts (docker-entrypoint.d).
# Renders /etc/nginx/nginx.conf from the template and picks the certificate:
#   TLS_MODE=letsencrypt  the one certbot keeps in /etc/letsencrypt; until it
#                         exists, a throwaway self-signed one so that port 80
#                         can answer the first challenge
#   TLS_MODE=files        fullchain.pem and privkey.pem from /etc/lifeline-tls
set -eu

: "${DOMAIN:?set DOMAIN}"
: "${TLS_MODE:=letsencrypt}"
: "${CKB_HOST:=ckb}"
: "${CKB_P2P_PORT:=8115}"
: "${CKB_RPC_PORT:=8114}"
: "${RPC_PUBLIC:=false}"
: "${RPC_RATE:=10r/s}"
: "${RPC_BURST:=20}"
: "${STREAM_ACCESS_LOG:=off}"

case "$TLS_MODE" in
  files)
    TLS_CERT=/etc/lifeline-tls/fullchain.pem
    TLS_KEY=/etc/lifeline-tls/privkey.pem
    ;;
  letsencrypt)
    TLS_CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
    TLS_KEY="/etc/letsencrypt/live/$DOMAIN/privkey.pem"
    if [ ! -f "$TLS_CERT" ]; then
      echo "lifeline: no certificate for $DOMAIN yet, using a temporary self-signed one"
      mkdir -p /etc/nginx/temporary-tls
      TLS_CERT=/etc/nginx/temporary-tls/fullchain.pem
      TLS_KEY=/etc/nginx/temporary-tls/privkey.pem
      if [ ! -f "$TLS_CERT" ]; then
        openssl req -x509 -nodes -newkey rsa:2048 -days 7 -subj "/CN=$DOMAIN" \
          -keyout "$TLS_KEY" -out "$TLS_CERT" 2>/dev/null
      fi
    fi
    ;;
  *)
    echo "lifeline: TLS_MODE must be letsencrypt or files, not $TLS_MODE" >&2
    exit 1
    ;;
esac

NJS_MODULE=""
NJS_IMPORT=""
RPC_LOCATIONS=""
if [ "$RPC_PUBLIC" = true ]; then
  NJS_MODULE="load_module modules/ngx_http_js_module.so;"
  NJS_IMPORT="js_import rpc from /lifeline/rpc.js;"
  export DOMAIN CKB_HOST CKB_RPC_PORT RPC_BURST
  RPC_LOCATIONS=$(envsubst '${DOMAIN} ${CKB_HOST} ${CKB_RPC_PORT} ${RPC_BURST}' < /lifeline/rpc-locations.conf.template)
fi

export DOMAIN CKB_HOST CKB_P2P_PORT RPC_RATE STREAM_ACCESS_LOG TLS_CERT TLS_KEY NJS_MODULE NJS_IMPORT RPC_LOCATIONS
envsubst '${DOMAIN} ${CKB_HOST} ${CKB_P2P_PORT} ${RPC_RATE} ${STREAM_ACCESS_LOG} ${TLS_CERT} ${TLS_KEY} ${NJS_MODULE} ${NJS_IMPORT} ${RPC_LOCATIONS}' \
  < /lifeline/nginx.conf.template > /etc/nginx/nginx.conf

echo "lifeline: serving $DOMAIN (certificate $TLS_CERT, public RPC $RPC_PUBLIC)"

# certbot renews the certificate in place; reloading twice a day picks it up.
if [ "$TLS_MODE" = letsencrypt ]; then
  (while sleep 43200; do nginx -s reload; done) &
fi
