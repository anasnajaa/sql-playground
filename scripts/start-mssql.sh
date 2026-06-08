#!/usr/bin/env bash
# =============================================================================
# start-mssql.sh — pull and run MSSQL 2025 with persistent data
# Run as root from /root/sql-playground/
# =============================================================================
set -euo pipefail

CONTAINER_NAME="sql-playground-mssql"
DATA_DIR="/root/sql-playground/data/mssql"
MSSQL_IMAGE="mcr.microsoft.com/mssql/server:2025-latest"
SA_PASSWORD="${MSSQL_SA_PASSWORD:-Sq1Ye6ucZTh_5K1__LqYP4Az9}"
DB_NAME="SqlPlayground"

# ── 1. Ensure data directory exists ──────────────────────────────────────────
mkdir -p "$DATA_DIR"
# MSSQL runs as UID 10001 inside the container
chown -R 10001:0 "$DATA_DIR" 2>/dev/null || true

# ── 2. Pull image ─────────────────────────────────────────────────────────────
echo "[mssql] Pulling image $MSSQL_IMAGE …"
docker pull "$MSSQL_IMAGE"

# ── 3. Remove old container if it exists ─────────────────────────────────────
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "[mssql] Stopping and removing existing container …"
  docker stop "$CONTAINER_NAME" || true
  docker rm   "$CONTAINER_NAME" || true
fi

# ── 4. Start container ────────────────────────────────────────────────────────
echo "[mssql] Starting container …"
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -e "ACCEPT_EULA=Y" \
  -e "MSSQL_SA_PASSWORD=${SA_PASSWORD}" \
  -e "MSSQL_PID=Developer" \
  -p 127.0.0.1:1433:1433 \
  -v "${DATA_DIR}:/var/opt/mssql/data" \
  --memory="1g" \
  --cpus="1.0" \
  "$MSSQL_IMAGE"

echo "[mssql] Container started. Waiting for SQL Server to be ready …"

# ── 5. Wait for SQL Server to accept connections ──────────────────────────────
for i in $(seq 1 30); do
  if docker exec "$CONTAINER_NAME" \
       /opt/mssql-tools18/bin/sqlcmd \
       -S "127.0.0.1,1433" -U sa -P "$SA_PASSWORD" -C \
       -Q "SELECT 1" &>/dev/null; then
    echo "[mssql] SQL Server is ready."
    break
  fi
  echo "[mssql] Attempt $i/30 — not ready yet, waiting 3s …"
  sleep 3
done

# ── 6. Create database if it doesn't exist ────────────────────────────────────
echo "[mssql] Ensuring database '$DB_NAME' exists …"
docker exec "$CONTAINER_NAME" \
  /opt/mssql-tools18/bin/sqlcmd \
  -S "127.0.0.1,1433" -U sa -P "$SA_PASSWORD" -C \
  -Q "IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'${DB_NAME}') CREATE DATABASE [${DB_NAME}];"

echo "[mssql] Database '$DB_NAME' is ready."
echo ""
echo "MSSQL is running. Next step: copy .env.example to .env and run the seed script."
echo "  cd /root/sql-playground/backend"
echo "  cp .env.example .env"
echo "  # Edit .env and set MSSQL_SA_PASSWORD to the same value used above."
