#!/bin/bash

BASEDIR=$(dirname "$0")
WORK_DIR=$BASEDIR/..
PTAU_ARTIFACTS="build/ptau"
CIRCUIT_ARTIFACTS="build/circuits"
VK_ARTIFACTS="build/vks"
ZKEY_ARTIFACTS="build/zkeys"
PHASE_1_FINAL=$PTAU_ARTIFACTS/pot17_final.ptau
cd $WORK_DIR
mkdir -p $VK_ARTIFACTS
mkdir -p $ZKEY_ARTIFACTS
MAX_JOB=1
i=0

phase2() {
    circuit="$(basename "$1" ".circom")"
    prefix="$CIRCUIT_ARTIFACTS/$circuit"
    snarkjs zkey new "$CIRCUIT_ARTIFACTS/$circuit.r1cs" "$PHASE_1_FINAL" "$ZKEY_ARTIFACTS/$circuit"_0000.zkey
    snarkjs zkey contribute "$ZKEY_ARTIFACTS/$circuit"_0000.zkey "$ZKEY_ARTIFACTS/$circuit"_0001.zkey --name="1st Contributor Name" -v -e="random entropy 1" # Testing purpose
    snarkjs zkey contribute "$ZKEY_ARTIFACTS/$circuit"_0001.zkey "$ZKEY_ARTIFACTS/$circuit"_0002.zkey --name="2nd Contributor Name" -v -e="random entropy 2" # Testing purpose
    snarkjs zkey verify "$CIRCUIT_ARTIFACTS/$circuit".r1cs $PHASE_1_FINAL "$ZKEY_ARTIFACTS/$circuit"_0002.zkey
    snarkjs zkey beacon "$ZKEY_ARTIFACTS/$circuit"_0002.zkey "$ZKEY_ARTIFACTS/$circuit".final.zkey 0102030405060708090a0b0c0d0e0f101112131415161717191a1b1c1d1e1f 10 -n="Final Beacon phase2"
    snarkjs zkey verify "$CIRCUIT_ARTIFACTS/$circuit".r1cs $PHASE_1_FINAL "$ZKEY_ARTIFACTS/$circuit".final.zkey
    TMP_DIR="build/tmp/$circuit"
    mkdir -p $TMP_DIR
    cp "$ZKEY_ARTIFACTS/$circuit".final.zkey $TMP_DIR/
    cd $TMP_DIR && snarkjs zkey export verificationkey "$circuit".final.zkey && cd $WORK_DIR
    mv $TMP_DIR/verification_key.json "$VK_ARTIFACTS/$circuit".vk.json
    rm -rf $TMP_DIR
}

for circuit_file in "impls"/*.circom;
do
    i=$(($i+1))
    phase2 $circuit_file &
    if (( $i % $MAX_JOB == 0 )); then wait; fi
done
wait
