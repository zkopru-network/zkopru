/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.7.4",
  networks: {
    hardhat: {
      chainId: 20200406,
      blockGasLimit: 12000000,
      mining: {
        auto: process.env.BLOCKTIME ? false : true,
        interval: process.env.BLOCKTIME
      },
      accounts: {
        mnemonic:
          "myth like bonus scare over problem client lizard pioneer submit female collect",
        count: 10
      }
    }
  }
};
