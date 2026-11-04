#!/bin/sh
# A separate database for the backend tests, so they never touch development data.
# The name must match DB_DATABASE in backend/phpunit.xml.
# Safe to run twice (README "First run" step 5 runs it by hand on an older volume).
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
-- CREATE DATABASE has no IF NOT EXISTS, so \gexec runs it only when the database is missing.
SELECT 'CREATE DATABASE natatorio_gym_test' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'natatorio_gym_test')\gexec
\c natatorio_gym_test
CREATE EXTENSION IF NOT EXISTS btree_gist;
SQL
