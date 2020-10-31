#!/bin/bash

BASEDIR=$(dirname "$0")
ARTIFACTS="build/circuits"
MAX_JOB=1
cd $BASEDIR/..
mkdir -p $ARTIFACTS
i=0
for circuit in "impls"/*.circom;
do
    i=$(($i+1))
    prefix="$ARTIFACTS/$(basename "$circuit" ".circom")"
    node --stack-size=8192 $(which circom) "$circuit" -r "$prefix.r1cs" && \
    echo "Circuit compile result: $(basename "$circuit" ".circom")" && \
    snarkjs info -r "$prefix.r1cs" &
    node --stack-size=8192 $(which circom) "$circuit" -c "$prefix.c" &
    node --stack-size=8192 $(which circom) "$circuit" -w "$prefix.wasm" &
    node --stack-size=8192 $(which circom) "$circuit" -s "$prefix.sym" &
    if (( $i % $MAX_JOB == 0 )); then wait; fi
done
wait
for circuit in "impls"/*.circom;
do
    prefix="$ARTIFACTS/$(basename "$circuit" ".circom")"
    snarkjs r1cs export json "$prefix.r1cs" "$prefix.json"
done
