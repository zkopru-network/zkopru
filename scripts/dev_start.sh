#!/bin/sh

set -e

while ! nc -z postgres 5432; do sleep 1; done;

exec gotty -w --port $PORT node /proj/packages/cli/dist/apps/coordinator/cli.js --config /proj/packages/cli/coordinator.dev.json
