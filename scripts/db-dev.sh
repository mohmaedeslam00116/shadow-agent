#!/bin/bash

# Database helper script for development environment
# Sets the DATABASE_URL to development database and runs Prisma command

# Development database URLs
# Desktop fork (decisions #7/#12): SQLite. Dev data is disposable; the
# packaged app uses userData/shadow.db via `migrate deploy` at startup.
# NOTE: Prisma resolves relative file: URLs against the schema directory
# (packages/db/prisma/), so the default is schema-dir-relative.
DB_FILE="${SHADOW_DB_FILE:-./dev.db}"
export DATABASE_URL="file:${DB_FILE}"
# DIRECT_URL removed with the Postgres provider swap (#7).

# Change to the db package directory
cd "$(dirname "$0")/../packages/db" || exit 1

# Run the Prisma command passed as arguments
exec npx prisma "$@"