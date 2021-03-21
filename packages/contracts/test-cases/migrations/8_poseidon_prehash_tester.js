const PoseidonPreHashTester = artifacts.require('PoseidonPreHashTester')

module.exports = function migration(deployer) {
  deployer.deploy(PoseidonPreHashTester)
}
