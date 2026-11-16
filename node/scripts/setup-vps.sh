#!/bin/sh
# Prepares a fresh Ubuntu 24.04 or Debian 12 server for the node:
# Docker from the distribution's packages and a firewall that lets in
# SSH, HTTP (certificate challenges), HTTPS (WSS) and P2P.
#
#   sudo sh node/scripts/setup-vps.sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo sh $0" >&2
  exit 1
fi

apt-get update
apt-get install -y docker.io docker-compose-v2 ufw git
systemctl enable --now docker

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8115/tcp
ufw --force enable

if [ -n "${SUDO_USER:-}" ]; then
  usermod -aG docker "$SUDO_USER"
  echo "Added $SUDO_USER to the docker group; log out and back in to use it."
fi

echo "Done. Next: cp node/.env.example node/.env, fill it in, then docs/node-recipe.md step 3."
