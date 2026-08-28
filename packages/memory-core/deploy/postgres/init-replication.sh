#!/bin/bash
set -euo pipefail

# ── TIMPS MemoryServer — Postgres primary init ──
# Runs once on first boot of postgres-primary (via /docker-entrypoint-initdb.d).
# Creates the replication role used by postgres-replica-1 / postgres-replica-2
# to run pg_basebackup and stream WAL.

REPLICATION_USER="${POSTGRES_REPLICATION_USER:-replicator}"
REPLICATION_PASSWORD="${POSTGRES_REPLICATION_PASSWORD:-timps_repl_secret}"

psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER:-timps}" --dbname "${POSTGRES_DB:-timps_memory}" <<-EOSQL
DO \$\$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${REPLICATION_USER}') THEN
      CREATE ROLE ${REPLICATION_USER} WITH REPLICATION LOGIN PASSWORD '${REPLICATION_PASSWORD}';
   END IF;
END
\$\$;
EOSQL

# The official postgres:16-alpine image ships a pg_hba.conf WITHOUT a TCP
# replication rule (only 127.0.0.1/::1), so streaming replicas on the compose
# network would be rejected with "no pg_hba.conf entry for replication".
# Append one for the docker network and reload.
if [ -f "${PGDATA}/pg_hba.conf" ]; then
  if ! grep -qE '^host[[:space:]]+replication[[:space:]]+all[[:space:]]+0\.0\.0\.0/0' "${PGDATA}/pg_hba.conf"; then
    echo "host replication all 0.0.0.0/0 scram-sha-256" >> "${PGDATA}/pg_hba.conf"
    psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER:-timps}" --dbname "${POSTGRES_DB:-timps_memory}" \
      -c "SELECT pg_reload_conf();" >/dev/null
  fi
fi

echo "init-replication: replication role '${REPLICATION_USER}' ready"
