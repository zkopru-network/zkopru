#!/bin/bash

BASEDIR=$(dirname "$0")
cd $BASEDIR/..

tar cvf keys.tgz build/circuits/*.wasm build/pks build/vks
