/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.7.4",
  networks: {
    hardhat: {
      chainId: 20200406,
      blockGasLimit: 12000000,
      forking: {
        url: "https://zkopru-testnet.sifnoc.net",
        blockNumber: 95 // Migration step 19 complete as 'testnet' network.
      },
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
