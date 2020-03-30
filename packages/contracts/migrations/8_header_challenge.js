const HeaderChallenge = artifacts.require('HeaderChallenge')

module.exports = function migration(deployer) {
  deployer.deploy(HeaderChallenge)
}
