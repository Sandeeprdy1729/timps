#!/bin/bash
set -euo pipefail

# ── TIMPS MemoryServer — Postgres streaming-replica entrypoint ──
# Bootstraps postgres-replica-1 / postgres-replica-2 as TRUE streaming
# replicas of postgres-primary:
#   1. On first boot (empty data dir) runs pg_basebackup against the primary.
#      -R writes standby.signal + primary_conninfo into postgresql.auto.conf.
#   2. Ensures a physical replication slot exists on the primary (WAL is
#      retained until the replica has consumed it, so a briefly-disconnected
#      replica can resync instead of being stranded).
#   3. Appends the full primary_conninfo (with password) and the standalone
#      primary_slot_name GUC — later postgresql.auto.conf lines override earlier.
#   4. Hands off to the official docker-entrypoint.sh to start postgres in
#      hot-standby mode.
#
# Requires POSTGRES_REPLICATION_USER / POSTGRES_REPLICATION_PASSWORD / the
# primary healthy, and is mounted read-only from deploy/postgres/.

PGDATA="${PGDATA:-/var/lib/postgresql/data}"
PRIMARY_HOST="${PRIMARY_HOST:-postgres-primary}"
PRIMARY_PORT="${PRIMARY_PORT:-5432}"
REPLICATION_USER="${POSTGRES_REPLICATION_USER:-replicator}"
REPLICATION_PASSWORD="${POSTGRES_REPLICATION_PASSWORD:-timps_repl_secret}"
SLOT_NAME="${POSTGRES_REPLICA_SLOT:-replica}"

if [ ! -s "${PGDATA}/PG_VERSION" ]; then
  echo "replica-entrypoint: empty data dir — bootstrapping from ${PRIMARY_HOST} via pg_basebackup"
  rm -rf "${PGDATA}"/* "${PGDATA}"/.[!.]*

  SLOT_ASSURED=0
  PGPASSWORD="${REPLICATION_PASSWORD}" psql -h "${PRIMARY_HOST}" -p "${PRIMARY_PORT}" \
    -U "${REPLICATION_USER}" -d postgres -v ON_ERROR_STOP=1 \
    -c "SELECT pg_create_physical_replication_slot('${SLOT_NAME}') WHERE NOT EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name = '${SLOT_NAME}');" \
    >/dev/null 2>&1 && SLOT_ASSURED=1 && echo "replica-entrypoint: replication slot '${SLOT_NAME}' ensured on primary" \
    || echo "replica-entrypoint: WARNING could not ensure slot '${SLOT_NAME}' on primary (continuing without it)"

  PGPASSWORD="${REPLICATION_PASSWORD}" pg_basebackup \
    -h "${PRIMARY_HOST}" -p "${PRIMARY_PORT}" \
    -U "${REPLICATION_USER}" \
    -D "${PGDATA}" \
    -X stream -R -P -v \
    -c fast

  # -R already wrote primary_conninfo (no password) — append ours and the
  # standalone primary_slot_name GUC (last settings win in auto.conf).
  # NOTE: primary_slot_name is a server parameter, NOT a libpq conninfo
  # option — it must be a separate line here.
  {
    echo "# TIMPS replica-entrypoint"
    echo "primary_conninfo = 'host=${PRIMARY_HOST} port=${PRIMARY_PORT} user=${REPLICATION_USER} password=${REPLICATION_PASSWORD} application_name=${SLOT_NAME}'"
    if [ "${SLOT_ASSURED}" = "1" ]; then
      echo "primary_slot_name = '${SLOT_NAME}'"
    fi
  } >> "${PGDATA}/postgresql.auto.conf"

  chown -R postgres:postgres "${PGDATA}"
  echo "replica-entrypoint: base backup complete — starting hot standby"
fi

exec docker-entrypoint.sh postgres -c hot_standby=on
