#!/bin/bash

BASEDIR=$(dirname "$0")
VK_ARTIFACTS="build/vks"
PK_ARTIFACTS="build/snarkjsPKs"
PK_BIN_ARTIFACTS="build/pks"
MAX_JOB=32
cd $BASEDIR/..
mkdir -p $VK_ARTIFACTS
mkdir -p $PK_ARTIFACTS
mkdir -p $PK_BIN_ARTIFACTS

i=0
for r1cs in "build/circuits"/*.r1cs;
do
    i=$(($i+1))
    r1cs_name="$(basename "$r1cs" ".r1cs")"
    snarkjs setup -r "$r1cs" --pk "$PK_ARTIFACTS/$r1cs_name.pk.json" --vk "$VK_ARTIFACTS/$r1cs_name.vk.json" --protocol groth && \
    node node_modules/wasmsnark/tools/buildpkey.js -i "$PK_ARTIFACTS/$r1cs_name.pk.json" -o "$PK_BIN_ARTIFACTS/$r1cs_name.pk.bin" &
    if (( $i % $MAX_JOB == 0 )); then wait; fi
done
wait
