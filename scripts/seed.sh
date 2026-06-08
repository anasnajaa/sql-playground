#!/usr/bin/env bash
# =============================================================================
# seed.sh — run seed SQL directly against the running MSSQL container
# Run from any directory; requires Docker and the container to be running.
# =============================================================================
set -euo pipefail

CONTAINER_NAME="sql-playground-mssql"
SEED_FILE="/root/sql-playground/backend/resources/seed.sql"
DB_NAME="${MSSQL_DATABASE:-SqlPlayground}"
SA_PASSWORD="${MSSQL_SA_PASSWORD:-Sq1Ye6ucZTh_5K1__LqYP4Az9}"

echo "[seed] Copying seed file into container …"
docker cp "$SEED_FILE" "${CONTAINER_NAME}:/tmp/seed.sql"

echo "[seed] Executing seed against database '$DB_NAME' …"
docker exec "$CONTAINER_NAME" \
  /opt/mssql-tools18/bin/sqlcmd \
  -S "127.0.0.1,1433" -U sa -P "$SA_PASSWORD" -C \
  -d "$DB_NAME" \
  -i /tmp/seed.sql

echo "[seed] Seed complete."
