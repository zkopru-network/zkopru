#!/bin/sh

# set -e

cd test-cases
# truffle test only executes one test file, so we execute it for each file :/
for file in $(find ./test | grep soltest.js); do
  truffle test "$file"
done
