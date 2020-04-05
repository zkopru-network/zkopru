console.log('> Compiling Poseidon library')
const path = require('path')
const fs = require('fs')

const poseidonGenContract = require('circomlib/src/poseidon_gencontract.js')
const Artifactor = require('@truffle/artifactor')

const SEED = 'poseidon'
const NROUNDSF = 8
const NROUNDSP = 57
const T = 6

const contractsDir = path.join(__dirname, '..', 'build/generated')
const artifactor = new Artifactor(contractsDir)
const poseidonContractName = 'Poseidon'
fs.mkdirSync(contractsDir, { recursive: true })
;(async () => {
  await artifactor.save({
    contractName: poseidonContractName,
    abi: poseidonGenContract.abi,
    unlinked_binary: poseidonGenContract.createCode(
      T,
      NROUNDSF,
      NROUNDSP,
      SEED,
    ),
  })
})()
