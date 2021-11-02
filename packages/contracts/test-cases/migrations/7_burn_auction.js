const BurnAuctionTester = artifacts.require("BurnAuctionTester");
const ZkopruStubTester = artifacts.require("ZkopruStubTester");

module.exports = function migration(deployer) {
  deployer
    .then(() => {
      return deployer.deploy(ZkopruStubTester);
    })
    .then(zkopru => {
      return deployer.deploy(BurnAuctionTester, zkopru.address);
    });
};
