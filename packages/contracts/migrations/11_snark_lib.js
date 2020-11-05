const SNARK = artifacts.require('SNARK')

module.exports = function migration(deployer) {
  deployer.deploy(SNARK)
}
