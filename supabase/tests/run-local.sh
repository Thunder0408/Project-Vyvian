#!/usr/bin/env bash
# Runs 0001_init.sql against a throwaway local PostgreSQL database (not Supabase).
# Needs a local PostgreSQL server and a superuser connection, e.g.:
#   PGUSER=postgres ./supabase/tests/run-local.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=vyvian_test_$$
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop role if exists anon" -c "drop role if exists authenticated" -c "create database $DB"
trap 'psql -q -d postgres -c "drop database if exists $DB" -c "drop role if exists anon" -c "drop role if exists authenticated"' EXIT
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/local_stub.sql
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/migrations/0001_init.sql
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/0001_init.test.sql
