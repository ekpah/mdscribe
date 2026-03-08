#!/bin/sh
set -eu

should_run_migrations="${RUN_DB_MIGRATIONS_ON_START:-true}"

case "$should_run_migrations" in
	1|true|TRUE|yes|YES|on|ON)
		echo "Running startup database migrations"
		bun ./packages/database/migrate-deploy.mjs
		;;
	0|false|FALSE|no|NO|off|OFF)
		echo "Skipping startup database migrations"
		;;
	*)
		echo "Invalid RUN_DB_MIGRATIONS_ON_START value: $should_run_migrations" >&2
		exit 1
		;;
esac

if [ "$#" -eq 0 ]; then
	set -- bun apps/app/server.js
fi

exec "$@"
