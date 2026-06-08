#!/usr/bin/env bash
# =============================================================================
# deploy.sh — full one-shot deployment for sql.kuwaitdevs.com
# Run as root from /root/sql-playground/ after cloning/updating.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== [1/7] Install backend dependencies ==="
cd "$PROJECT_DIR/backend"
npm install --omit=dev

echo "=== [2/7] Install frontend dependencies and build ==="
cd "$PROJECT_DIR/frontend"
npm install
npm run build

echo "=== [3/7] Copy .env if not present ==="
cd "$PROJECT_DIR/backend"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "  Created .env from .env.example. Edit it now if you haven't already."
  echo "  Press Enter when ready to continue, or Ctrl+C to abort."
  read -r
fi

echo "=== [4/7] Start MSSQL container ==="
bash "$SCRIPT_DIR/start-mssql.sh"

echo "=== [5/7] Run initial seed ==="
bash "$SCRIPT_DIR/seed.sh"

echo "=== [6/7] Install supervisor config ==="
cp "$PROJECT_DIR/examples/sql-playground.supervisor.conf" \
   /etc/supervisor/conf.d/sql-playground.conf
supervisorctl reread
supervisorctl update
supervisorctl start sql-playground || true

echo "=== [7/7] Install nginx vhost ==="
cp "$PROJECT_DIR/examples/sql.kuwaitdevs.com.nginx" \
   /etc/nginx/sites-available/sql.kuwaitdevs.com

if [ ! -L /etc/nginx/sites-enabled/sql.kuwaitdevs.com ]; then
  ln -s /etc/nginx/sites-available/sql.kuwaitdevs.com \
        /etc/nginx/sites-enabled/sql.kuwaitdevs.com
fi

nginx -t && systemctl reload nginx

echo ""
echo "=== Deploy complete ==="
echo "If you haven't done so, run certbot for TLS:"
echo "  certbot --nginx -d sql.kuwaitdevs.com"
