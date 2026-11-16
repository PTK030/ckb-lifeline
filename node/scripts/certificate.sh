#!/bin/sh
# Issues the first Let's Encrypt certificate for DOMAIN and restarts Nginx to
# use it. certbot renews it from then on. Run once the DNS record points here
# and `docker compose up -d` is running.
#
#   sh node/scripts/certificate.sh
set -eu
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "No node/.env yet: copy .env.example and fill it in." >&2
  exit 1
fi
# shellcheck disable=SC1091
. ./.env
: "${DOMAIN:?set DOMAIN in node/.env}"
: "${ACME_EMAIL:?set ACME_EMAIL in node/.env}"

docker compose run --rm --entrypoint certbot certbot certonly \
  --webroot -w /var/www/acme \
  -d "$DOMAIN" \
  --email "$ACME_EMAIL" --agree-tos --no-eff-email \
  --non-interactive

docker compose restart nginx
echo "Certificate in place. Check it: npx lifeline check \"\$(sh node/scripts/address.sh)\""
