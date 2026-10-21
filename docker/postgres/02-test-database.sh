#!/bin/sh
# A separate database for the backend tests, so they never touch development data.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE DATABASE ${POSTGRES_DB}_test;
\c ${POSTGRES_DB}_test
CREATE EXTENSION IF NOT EXISTS btree_gist;
SQL
