#!/bin/sh

set -e

yes | prisma migrate up --experimental --schema /proj/packages/prisma/prisma/postgres-migrator.prisma --verbose

exec gotty -w --port 1234 node /proj/packages/cli/dist/apps/coordinator/cli.js --config /proj/packages/cli/coordinator.dev.json
