#!/bin/bash

BASEDIR=$(dirname "$0")
PTAU_ARTIFACTS="build/ptau"
mkdir -p $PTAU_ARTIFACTS
cd $BASEDIR/../$PTAU_ARTIFACTS

snarkjs powersoftau new bn128 17 pot17_0000.ptau -v
snarkjs powersoftau contribute pot17_0000.ptau pot17_0001.ptau --name="Sample contribution 1" -v -e="some random text 1"
snarkjs powersoftau contribute pot17_0001.ptau pot17_0002.ptau --name="Sample contribution 1" -v -e="some random text 2"
# skip the 3rd party contribution
snarkjs powersoftau verify pot17_0002.ptau
snarkjs powersoftau beacon pot17_0002.ptau pot17_beacon.ptau 0102030405060708090a0b0c0d0e0f101112131415161717191a1b1c1d1e1f 10 -n="Final Beacon"
snarkjs powersoftau prepare phase2 pot17_beacon.ptau pot17_final.ptau -v