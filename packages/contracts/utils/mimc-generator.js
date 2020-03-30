console.log('> Compiling MiMC library')
const path = require('path')
const fs = require('fs')

const mimcGenContract = require('circomlib/src/mimcsponge_gencontract.js')
const Artifactor = require('truffle-artifactor')

const SEED = 'mimcsponge'

const contractsDir = path.join(__dirname, '..', 'build/generated')
const artifactor = new Artifactor(contractsDir)
const mimcContractName = 'MiMC'
fs.mkdirSync(contractsDir, { recursive: true })
;(async () => {
  await artifactor.save({
    contractName: mimcContractName,
    abi: mimcGenContract.abi,
    unlinked_binary: mimcGenContract.createCode(SEED, 220),
  })
})()
