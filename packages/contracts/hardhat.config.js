/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: '0.7.4',
  networks: {
    hardhat: {
      chainId: 20200406,
      blockGasLimit: 12000000,
      interval: 5000,
      accounts: {
        mnemonic: "myth like bonus scare over problem client lizard pioneer submit female collect",
        count: 10
      }
    },
  },
}
