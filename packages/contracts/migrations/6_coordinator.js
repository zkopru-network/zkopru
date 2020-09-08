// const Poseidon = artifacts.require('Poseidon')
const Coordinatable = artifacts.require('Coordinatable')

module.exports = function migration(deployer) {
  deployer.deploy(Coordinatable)
}
