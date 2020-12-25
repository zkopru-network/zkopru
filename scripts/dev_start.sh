#!/bin/sh

set -e

while ! nc -z postgres 5432; do sleep 1; done;

if [ -z $SKIP_MIGRATE ]
then
  yes | prisma migrate up --experimental --schema /proj/packages/prisma/prisma/postgres-migrator.prisma --verbose
fi

exec gotty -w --port $PORT node /proj/packages/cli/dist/apps/coordinator/cli.js --config /proj/packages/cli/coordinator.dev.json
