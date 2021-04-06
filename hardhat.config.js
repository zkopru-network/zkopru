/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: '0.7.4',
  networks: {
    hardhat: {
      chainID: '20200406',
      blockGasLimit: 12000000,
      interval: 5000,
    },
  },
}
