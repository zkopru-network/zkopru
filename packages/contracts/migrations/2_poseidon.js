const path = require('path')

const poseidonGenContract = require('circomlib/src/poseidon_gencontract')
const Artifactor = require('@truffle/artifactor')

module.exports = function migration(deployer) {
  return deployer.then(async () => {
    const contractsDir = path.join(__dirname, '../build/contracts')
    const artifactor = new Artifactor(contractsDir)
    // Deploy poseidon with a specific number of args
    const deployX = async x => {
      const poseidonX = args => `Poseidon${args}`
      await artifactor.save({
        contractName: poseidonX(x),
        abi: poseidonGenContract.abi,
        unlinked_binary: poseidonGenContract.createCode(x),
      })
      await deployer.deploy(artifacts.require(poseidonX(x)))
    }
    await deployX(2)
    await deployX(3)
    await deployX(4)
  })
}
