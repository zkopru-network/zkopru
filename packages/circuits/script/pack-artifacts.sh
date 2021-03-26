#!/bin/bash

BASEDIR=$(dirname "$0")
WORK_DIR=$BASEDIR/..
PTAU_ARTIFACTS="build/ptau"
CIRCUIT_ARTIFACTS="build/circuits"
VK_ARTIFACTS="build/vks"
ZKEY_ARTIFACTS="build/zkeys"

KEYS_ARTIFACTS="keys"

cd $WORK_DIR

mkdir -p $KEYS_ARTIFACTS/circuits
mkdir -p $KEYS_ARTIFACTS/vks
mkdir -p $KEYS_ARTIFACTS/zkeys

cp $CIRCUIT_ARTIFACTS/*.wasm $KEYS_ARTIFACTS/circuits
cp $ZKEY_ARTIFACTS/*.zkey $KEYS_ARTIFACTS/zkeys
rm $KEYS_ARTIFACTS/zkeys/*_000*.zkey
cp $VK_ARTIFACTS/*.json $KEYS_ARTIFACTS/vks

tar -czvf $KEYS_ARTIFACTS.tgz $KEYS_ARTIFACTS/*