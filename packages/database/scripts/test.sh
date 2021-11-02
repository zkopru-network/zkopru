#!/bin/sh

# Kill any hanging container if needed
docker kill POSTGRES_TEST 2> /dev/null
# Create a postgres server for testing
docker run --rm --name POSTGRES_TEST -d -e POSTGRES_PASSWORD=password -e POSTGRES_USER=postgres -p 5432:5432 postgres

jest

# Destroy the postgres server
docker kill POSTGRES_TEST
