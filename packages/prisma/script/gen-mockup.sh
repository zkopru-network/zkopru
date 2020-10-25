#!/bin/bash

CHANGED=$(git diff schema.prisma)

if [[ "$CHANGED" ]]; then
    mkdir -p tmp
    cp -f prisma/base.prisma tmp/ && rm -f mockup.db
    prisma migrate save -c -n \"mockup\" --experimental --schema tmp/base.prisma && prisma migrate up --experimental --schema tmp/base.prisma
    rm -rf tmp
    echo "created mockup.db"
else
    echo "do nothing"
fi