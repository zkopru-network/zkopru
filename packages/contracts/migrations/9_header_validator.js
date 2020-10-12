const HeaderValidator = artifacts.require('HeaderValidator')

module.exports = function migration(deployer) {
  deployer.deploy(HeaderValidator)
}
