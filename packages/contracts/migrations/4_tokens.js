const TestERC20 = artifacts.require('TestERC20')
const TestERC721 = artifacts.require('TestERC721')

module.exports = function migration(deployer) {
  deployer.deploy(TestERC20)
  deployer.deploy(TestERC721)
}
