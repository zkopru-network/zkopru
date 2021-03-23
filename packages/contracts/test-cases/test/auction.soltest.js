const chai = require("chai");
const timeMachine = require("ganache-time-traveler");
const BN = require("bn.js");

const BurnAuctionTester = artifacts.require("BurnAuctionTester");
const ZkopruStubTester = artifacts.require("ZkopruStubTester");

contract("BurnAuction tests", async accounts => {
  let burnAuction;
  let zkopru;
  let startBlock;
  let roundLength;
  let auctionStart;
  let auctionEnd;
  before(async () => {
    burnAuction = await BurnAuctionTester.deployed();
    zkopru = await ZkopruStubTester.deployed();
    await zkopru.setConsensusProvider(burnAuction.address);
    startBlock = +(await burnAuction.startBlock()).toString();
    roundLength = +(await burnAuction.roundLength()).toString();
    auctionStart = +(await burnAuction.auctionStart()).toString();
    auctionEnd = +(await burnAuction.auctionEnd()).toString();
    // Set the url so bids succeed
    await burnAuction.setUrl("localhost:8080", {
      from: accounts[0]
    });
    await burnAuction.setUrl("localhost", {
      from: accounts[1]
    });
  });

  describe("biddable rounds", () => {
    it("should return nearest biddable round", async () => {
      const round = await burnAuction.earliestBiddableRound();
      await burnAuction.bid(round, {
        from: accounts[0],
        value: await burnAuction.minNextBid(round)
      });
      await burnAuction.bid(+round + 1, {
        from: accounts[0],
        value: await burnAuction.minNextBid(+round + 1)
      });
      try {
        await burnAuction.bid(+round - 1, {
          from: accounts[0],
          value: await burnAuction.minNextBid(+round - 1)
        });
        chai.assert(false, "Should fail to bid on earlier round");
      } catch (err) {
        chai.assert(
          err.reason === "BurnAuction: Bid is too close to round start"
        );
      }
    });

    it("should return furthest biddable round", async () => {
      const round = await burnAuction.latestBiddableRound();
      await burnAuction.bid(round, {
        from: accounts[0],
        value: await burnAuction.minNextBid(round)
      });
      await burnAuction.bid(+round - 1, {
        from: accounts[0],
        value: await burnAuction.minNextBid(+round - 1)
      });
      try {
        await burnAuction.bid(+round + 1, {
          from: accounts[0],
          value: await burnAuction.minNextBid(+round + 1)
        });
        chai.assert(false, "Should fail to bid on later round");
      } catch (err) {
        chai.assert(
          err.reason === "BurnAuction: Bid is too far from round start"
        );
      }
    });
  });

  describe("bidding test", () => {
    it("should fail to bid on 0th auction", async () => {
      const currentRound = +(await burnAuction.currentRound()).toString();
      try {
        await burnAuction.bid(currentRound, {
          from: accounts[0]
        });
        chai.assert(false);
      } catch (err) {
        chai.assert(err.reason === "BurnAuction: Round is in past");
      }
    });

    it("should fail to bid on auction too close", async () => {
      const currentRound = +(await burnAuction.currentRound()).toString();
      const roundStartBlock = +(
        await burnAuction.calcRoundStart(currentRound)
      ).toString();
      const targetRound = +(
        await burnAuction.roundForBlock(
          roundStartBlock + roundLength + auctionEnd - 1
        )
      ).toString();
      try {
        await burnAuction.bid(targetRound, {
          from: accounts[0]
        });
        chai.assert(false, "Auction bid should fail");
      } catch (err) {
        chai.assert(
          err.reason === "BurnAuction: Bid is too close to round start"
        );
      }
    });

    it("should fail to bid on auction too far", async () => {
      const currentRound = +(await burnAuction.currentRound()).toString();
      const roundStartBlock = +(
        await burnAuction.calcRoundStart(currentRound)
      ).toString();
      const targetRound = +(
        await burnAuction.roundForBlock(
          roundStartBlock + roundLength + auctionStart
        )
      ).toString();
      try {
        await burnAuction.bid(targetRound, {
          from: accounts[0]
        });
        chai.assert(false, "Auction bid should fail");
      } catch (err) {
        chai.assert(
          err.reason === "BurnAuction: Bid is too far from round start"
        );
      }
    });

    it("should fail to bid without funds", async () => {
      await burnAuction.refund({
        from: accounts[0]
      });
      const targetRound = await burnAuction.earliestBiddableRound();
      const bidAmount = new BN(web3.utils.toWei("1")); // 1 ether
      try {
        await burnAuction.methods["bid(uint256,uint256)"](
          targetRound,
          bidAmount,
          {
            from: accounts[0]
          }
        );
        chai.assert(false, "Bid should fail");
      } catch (err) {
        chai.assert(err.reason === "BurnAuction: Insufficient funds");
      }
    });

    it("should fail to pay overloaded bid function", async () => {
      await burnAuction.refund({
        from: accounts[0]
      });
      const targetRound = await burnAuction.earliestBiddableRound();
      const bidAmount = new BN(web3.utils.toWei("1")); // 1 ether
      try {
        await burnAuction.methods["bid(uint256,uint256)"](
          targetRound,
          bidAmount,
          {
            from: accounts[0],
            value: bidAmount
          }
        );
        chai.assert(false, "Bid should fail");
      } catch (err) {
        chai.assert(err.reason === undefined);
      }
    });

    it("should fail to bid on past auction", async () => {
      try {
        await burnAuction.bid(0, {
          from: accounts[0]
        });
        chai.assert(false, "Past auction bid should fail");
      } catch (err) {
        chai.assert(err.reason === "BurnAuction: Round is in past");
      }
    });

    it("should fail to bid if no url", async () => {
      const currentRound = +(await burnAuction.currentRound()).toString();
      const roundStartBlock = +(
        await burnAuction.calcRoundStart(currentRound)
      ).toString();
      const targetRound = +(
        await burnAuction.roundForBlock(
          roundStartBlock + roundLength + auctionEnd + 1
        )
      ).toString();
      const bidAmount = await burnAuction.minNextBid(targetRound);
      try {
        await burnAuction.bid(targetRound, {
          from: accounts[9],
          value: bidAmount
        });
        chai.assert(false, "Bid should fail if no url");
      } catch (err) {
        chai.assert(err.reason === "BurnAuction: Coordinator url not set");
      }
    });

    it("should bid on near auction", async () => {
      const targetRound = +(await burnAuction.earliestBiddableRound());
      await burnAuction.bid(targetRound, {
        from: accounts[1],
        value: await burnAuction.minNextBid(targetRound)
      });
      const originalBalance = await burnAuction.pendingBalances(accounts[0]);
      const bidAmount = await burnAuction.minNextBid(targetRound);
      await burnAuction.bid(targetRound, {
        from: accounts[0],
        value: bidAmount
      });
      const newBalance = await burnAuction.pendingBalances(accounts[0]);
      chai.assert(originalBalance.eq(newBalance), "Pending balance incorrect");
      const highBid = await burnAuction.highestBidPerRound(targetRound);
      chai.assert.equal(highBid.owner, accounts[0], "Incorrect high bid owner");
      chai.assert(highBid.amount.eq(bidAmount), "Incorrect high bid amount");
    });

    it("should bid on far auction", async () => {
      const targetRound = +(await burnAuction.latestBiddableRound());
      await burnAuction.bid(targetRound, {
        from: accounts[1],
        value: await burnAuction.minNextBid(targetRound)
      });
      const bidAmount = await burnAuction.minNextBid(targetRound);
      const originalBalance = await burnAuction.pendingBalances(accounts[0]);
      await burnAuction.bid(targetRound, {
        from: accounts[0],
        value: bidAmount
      });
      const newBalance = await burnAuction.pendingBalances(accounts[0]);
      chai.assert(originalBalance.eq(newBalance), "Pending balance incorrect");
      const highBid = await burnAuction.highestBidPerRound(targetRound);
      chai.assert.equal(highBid.owner, accounts[0], "Incorrect high bid owner");
      chai.assert(highBid.amount.eq(bidAmount), "Incorrect high bid amount");
    });

    it("should fail to bid too little", async () => {
      const currentRound = +(await burnAuction.currentRound()).toString();
      const roundStartBlock = +(
        await burnAuction.calcRoundStart(currentRound)
      ).toString();
      const targetRound = +(
        await burnAuction.roundForBlock(
          roundStartBlock + roundLength + auctionStart / 2
        )
      ).toString();
      const bidAmount = (await burnAuction.minNextBid(targetRound)).sub(
        new BN("1")
      );
      try {
        await burnAuction.bid(targetRound, {
          from: accounts[0],
          value: bidAmount
        });
        chai.assert(false);
      } catch (err) {
        chai.assert(err.reason === "BurnAuction: Bid not high enough");
      }
    });

    it("should have valid minimum bid", async () => {
      const currentRound = +(await burnAuction.currentRound()).toString();
      const roundStartBlock = +(
        await burnAuction.calcRoundStart(currentRound)
      ).toString();
      // find a round without a bid
      const targetRound = +(
        await burnAuction.roundForBlock(
          roundStartBlock + roundLength + auctionStart / 2 + 10000
        )
      ).toString();
      const bid = await burnAuction.highestBidPerRound(targetRound);
      chai.assert(bid.amount.eq(new BN("0")));
      const minBid = await burnAuction.minBid();
      {
        const minNextBid = await burnAuction.minNextBid(targetRound);
        chai.assert(minNextBid.gt(minBid));
      }
      const bidAmount = minBid.mul(new BN("2"));
      // Do the bid, then test again
      await burnAuction.bid(targetRound, {
        from: accounts[0],
        value: bidAmount
      });
      {
        const minNextBid = await burnAuction.minNextBid(targetRound);
        chai.assert(minNextBid.gt(bidAmount));
      }
    });

    it("should refund bid when outbid", async () => {
      const currentRound = +(await burnAuction.currentRound()).toString();
      const roundStartBlock = +(
        await burnAuction.calcRoundStart(currentRound)
      ).toString();
      const targetRound = +(
        await burnAuction.roundForBlock(
          roundStartBlock + roundLength + auctionStart / 2
        )
      ).toString();
      const bidAmount = await burnAuction.minNextBid(targetRound);
      // Do first bid
      const originalBalance = await burnAuction.pendingBalances(accounts[0]);
      await burnAuction.bid(targetRound, {
        from: accounts[0],
        value: bidAmount
      });
      const nextBidAmount = await burnAuction.minNextBid(targetRound);
      await burnAuction.bid(targetRound, {
        from: accounts[1],
        value: nextBidAmount
      });
      const newBalance = await burnAuction.pendingBalances(accounts[0]);
      chai.assert(originalBalance.add(bidAmount).eq(newBalance));
    });
  });

  describe("multibid test", () => {
    it("should fail to bid on invalid auctions", async () => {
      const startRound = +(await burnAuction.earliestBiddableRound()) - 1;
      const endRound = startRound + 10;
      const maxBid = web3.utils.toWei("1"); // 1 ether
      try {
        await burnAuction.multiBid(0, maxBid, startRound, endRound, {
          from: accounts[0],
          value: web3.utils.toWei("1")
        });
        chai.assert(false, "Should fail to bid on too near round");
      } catch (err) {
        chai.assert(
          err.reason === "BurnAuction: Bid is too close to round start"
        );
      }
    });

    it("should store leftover funds in balance", async () => {
      const startRound = await burnAuction.earliestBiddableRound();
      const endRound = +startRound + 10;
      const maxBid = new BN(web3.utils.toWei("1")); // 1 ether
      await burnAuction.multiBid(0, maxBid, startRound, endRound, {
        from: accounts[1],
        value: maxBid
      });
      const startBalance = await burnAuction.pendingBalances(accounts[0]);
      let expectedTotalBid = new BN("0");
      for (let x = +startRound; x <= +endRound; x += 1) {
        expectedTotalBid = expectedTotalBid
          .clone()
          .add(await burnAuction.minNextBid(x));
      }
      await burnAuction.multiBid(0, maxBid, startRound, endRound, {
        from: accounts[0],
        value: maxBid
      });
      const finalBalance = await burnAuction.pendingBalances(accounts[0]);
      chai.assert(
        finalBalance.eq(startBalance.add(maxBid).sub(expectedTotalBid)),
        "Final balance is incorrect"
      );
    });

    it("should bid until out of funds", async () => {
      const startRound = await burnAuction.earliestBiddableRound();
      const endRound = +startRound + 10;
      const maxBid = new BN(web3.utils.toWei("1")); // 1 ether
      await burnAuction.multiBid(0, maxBid, startRound, endRound, {
        from: accounts[1],
        value: maxBid
      });
      await burnAuction.refund({
        from: accounts[0]
      });
      const minBid = new BN(web3.utils.toWei("0.1")); // 0.1 ether
      const bidCount = 3;
      await burnAuction.multiBid(minBid, maxBid, startRound, endRound, {
        from: accounts[0],
        value: minBid.mul(new BN(bidCount.toString())) // Only bid on bidCount rounds
      });
      for (let x = +startRound; x < +startRound + bidCount; x += 1) {
        const highBid = await burnAuction.highestBidPerRound(x);
        chai.assert(
          highBid.owner === accounts[0],
          `Expected account 0 to be round owner for round ${x}`
        );
      }
      for (let x = +startRound + bidCount; x <= +endRound; x += 1) {
        const highBid = await burnAuction.highestBidPerRound(x);
        chai.assert(
          highBid.owner === accounts[1],
          `Expected account 1 to be round owner for round ${x}`
        );
      }
      const finalBalance = await burnAuction.pendingBalances(accounts[0]);
      chai.assert(finalBalance.eq(new BN("0")), "Incorrect final balance");
    });
  });

  describe("url test", () => {
    it("should set url", async () => {
      const url = "localhost";
      await burnAuction.setUrl(url, {
        from: accounts[1]
      });
      const networkUrl = await burnAuction.coordinatorUrls(accounts[1]);
      chai.assert(
        networkUrl === url,
        `Network url incorrect, expected ${url} got ${networkUrl}`
      );
    });

    it("should clear url", async () => {
      const url = "localhost";
      await burnAuction.setUrl(url, {
        from: accounts[1]
      });
      const networkUrl = await burnAuction.coordinatorUrls(accounts[1]);
      chai.assert(
        networkUrl === url,
        `First network url incorrect, expected ${url} got ${networkUrl}`
      );
      await burnAuction.clearUrl({
        from: accounts[1]
      });
      const newNetworkUrl = await burnAuction.coordinatorUrls(accounts[1]);
      chai.assert(
        newNetworkUrl === "",
        `Second network url incorrect, expected nothing got ${newNetworkUrl}`
      );
    });
  });

  describe("refund test", () => {
    it("should refund empty balance", async () => {
      const contractBalance = new BN(
        await web3.eth.getBalance(burnAuction.address, "latest")
      );
      await burnAuction.refund({
        from: accounts[9]
      });
      const newContractBalance = new BN(
        await web3.eth.getBalance(burnAuction.address, "latest")
      );
      chai.assert(
        contractBalance.eq(newContractBalance),
        "Contract balance should not change"
      );
    });

    it("should refund balance once", async () => {
      const currentRound = +(await burnAuction.currentRound()).toString();
      const roundStartBlock = +(
        await burnAuction.calcRoundStart(currentRound)
      ).toString();
      const targetRound = +(
        await burnAuction.roundForBlock(
          roundStartBlock + roundLength + auctionStart / 2
        )
      ).toString();
      await burnAuction.setUrl("localhost", {
        from: accounts[3]
      });
      await burnAuction.bid(targetRound, {
        from: accounts[3],
        value: await burnAuction.minNextBid(targetRound)
      });
      // outbid self to get a pending balance
      await burnAuction.bid(targetRound, {
        from: accounts[3],
        value: await burnAuction.minNextBid(targetRound)
      });
      const pendingBalance = await burnAuction.pendingBalances(accounts[3]);
      const addressBalance = new BN(
        await web3.eth.getBalance(accounts[3], "latest")
      );
      // Use alt account to avoid gas cost calculation
      await burnAuction.methods["refund(address)"](accounts[3], {
        from: accounts[9]
      });
      const finalBalance = new BN(
        await web3.eth.getBalance(accounts[3], "latest")
      );
      chai.assert(addressBalance.add(pendingBalance).eq(finalBalance));
      const newPendingBalance = await burnAuction.pendingBalances(accounts[3]);
      chai.assert(newPendingBalance.eq(new BN("0")));
      await burnAuction.methods["refund(address)"](accounts[3], {
        from: accounts[9]
      });
      const finalBalance2 = new BN(
        await web3.eth.getBalance(accounts[3], "latest")
      );
      chai.assert(finalBalance2.eq(finalBalance));
    });
  });

  describe("open round tests", () => {
    it("should not open round", async () => {
      const currentRound = +(await burnAuction.currentRound()).toString();
      const roundStartBlock = +(
        await burnAuction.calcRoundStart(currentRound)
      ).toString();
      const targetRound = +(
        await burnAuction.roundForBlock(
          roundStartBlock + roundLength + auctionEnd
        )
      ).toString();
      const targetRoundStart = +(
        await burnAuction.calcRoundStart(targetRound)
      ).toString();
      const bidAmount = await burnAuction.minNextBid(targetRound);
      await burnAuction.setUrl("localhost", {
        from: accounts[5]
      });
      await burnAuction.bid(targetRound, {
        from: accounts[5],
        value: bidAmount
      });
      // advance the blockchain
      while ((await web3.eth.getBlock("latest")).number < targetRoundStart) {
        await timeMachine.advanceBlock();
      }
      chai.assert(
        +(await burnAuction.currentRound()).toString() === targetRound
      );
      // now we're in the round controlled by accounts[5]
      chai.assert(!(await burnAuction.isRoundOpen()), "Round is already open");
      await burnAuction.openRoundIfNeeded();
      chai.assert(
        !(await burnAuction.isRoundOpen()),
        "Round should not be opened"
      );
      await zkopru.propose(accounts[5]);
      // advance the blockchain further
      while (
        (await web3.eth.getBlock("latest")).number <
        targetRoundStart + roundLength / 2
      ) {
        await timeMachine.advanceBlock();
      }
      await burnAuction.openRoundIfNeeded();
      chai.assert(
        !(await burnAuction.isRoundOpen()),
        "Round should not be opened after half"
      );
    });

    it("should open round if no proposed block in first half", async () => {
      const currentRound = +(await burnAuction.currentRound()).toString();
      const roundStartBlock = +(
        await burnAuction.calcRoundStart(currentRound)
      ).toString();
      const targetRound = +(
        await burnAuction.roundForBlock(
          roundStartBlock + roundLength + auctionEnd
        )
      ).toString();
      const targetRoundStart = +(
        await burnAuction.calcRoundStart(targetRound)
      ).toString();
      const bidAmount = await burnAuction.minNextBid(targetRound);
      await burnAuction.bid(targetRound, {
        from: accounts[5],
        value: bidAmount
      });
      // advance the blockchain
      while ((await web3.eth.getBlock("latest")).number < targetRoundStart) {
        await timeMachine.advanceBlock();
      }
      chai.assert(
        +(await burnAuction.currentRound()).toString() === targetRound
      );
      // now we're in the round controlled by accounts[5]
      chai.assert(!(await burnAuction.isRoundOpen()), "Round is already open");
      await burnAuction.openRoundIfNeeded();
      chai.assert(
        !(await burnAuction.isRoundOpen()),
        "Round should not be opened"
      );
      // advance the blockchain past halfway point
      while (
        (await web3.eth.getBlock("latest")).number <
        targetRoundStart + roundLength / 2
      ) {
        await timeMachine.advanceBlock();
      }
      await burnAuction.openRoundIfNeeded();
      chai.assert(
        await burnAuction.isRoundOpen(),
        "Round should be opened after half"
      );
    });
  });

  describe("balance tests", () => {
    it("should update balance", async () => {
      const currentRound = +(await burnAuction.currentRound()).toString();
      // calculate the expected balance here
      let balance = new BN("0");
      for (let x = 0; x <= currentRound; x += 1) {
        const highBid = await burnAuction.highestBidPerRound(x);
        balance = balance.clone().add(highBid.amount);
      }
      const startBalance = await burnAuction.balance();
      chai.assert(startBalance.eq(new BN("0")), "Contract balance is non-zero");
      await burnAuction.updateBalance({
        from: accounts[8]
      });
      const contractBalance = await burnAuction.balance();
      chai.assert(contractBalance.eq(balance));
    });

    it("should update balance many times", async () => {
      const targetRound = +(await burnAuction.earliestBiddableRound());
      const count = 5;
      const finalRound = targetRound + count;
      // Bid a bunch of rounds in the future
      for (let x = 0; x < count + 10; x += 1) {
        const bidAmount = await burnAuction.minNextBid(targetRound + x);
        await burnAuction.bid(targetRound + x, {
          from: accounts[0],
          value: bidAmount
        });
      }
      const targetBlock = await burnAuction.calcRoundStart(finalRound);
      while ((await web3.eth.getBlock("latest")).number < targetBlock) {
        await timeMachine.advanceBlock();
      }
      const currentRound2 = +(await burnAuction.currentRound());
      const lastBalanceUpdate = +(await burnAuction.lastBalanceIndex());
      let balance = new BN("0");
      // Calculate the balance change
      for (let x = lastBalanceUpdate + 1; x <= currentRound2; x += 1) {
        const highBid = await burnAuction.highestBidPerRound(x);
        balance = balance.clone().add(highBid.amount);
      }
      const startBalance = await burnAuction.balance();
      await burnAuction.updateBalance({
        from: accounts[8]
      });
      const newBalance = await burnAuction.balance();
      const expectedBalance = balance.add(startBalance);
      chai.assert(
        newBalance.eq(expectedBalance),
        `Incorrect balance, expected ${expectedBalance.toString()} got ${newBalance.toString()}`
      );
      // Jump further in the future
      const targetBlock2 = await burnAuction.calcRoundStart(finalRound + 5);
      while ((await web3.eth.getBlock("latest")).number < targetBlock2) {
        await timeMachine.advanceBlock();
      }
      const currentRound3 = +(await burnAuction.currentRound()).toString();
      const newLastBalanceUpdate = +(await burnAuction.lastBalanceIndex());
      // calculate the balance change
      for (let x = newLastBalanceUpdate + 1; x <= currentRound3; x += 1) {
        const highBid = await burnAuction.highestBidPerRound(x);
        balance = balance.clone().add(highBid.amount);
      }
      await burnAuction.updateBalance({
        from: accounts[8]
      });
      const finalExpectedBalance = balance.add(startBalance);
      const finalNewBalance = await burnAuction.balance();
      chai.assert(
        finalNewBalance.eq(finalExpectedBalance),
        `Incorrect second balance`
      );
    });

    it("should update balance with specific iterations", async () => {
      const targetRound = +(await burnAuction.earliestBiddableRound());
      const count = 15;
      const finalRound = targetRound + count;
      // Bid a bunch of rounds in the future
      for (let x = 0; x < count; x += 1) {
        await burnAuction.bid(targetRound + x, {
          from: accounts[0],
          value: await burnAuction.minNextBid(targetRound + x)
        });
      }
      const startBlock = await burnAuction.calcRoundStart(targetRound - 1);
      while ((await web3.eth.getBlock("latest")).number < startBlock) {
        await timeMachine.advanceBlock();
      }
      // settle up to the targetRound
      await burnAuction.updateBalance({
        from: accounts[8]
      });
      const targetBlock = await burnAuction.calcRoundStart(finalRound);
      while ((await web3.eth.getBlock("latest")).number < targetBlock) {
        await timeMachine.advanceBlock();
      }
      let balance = await burnAuction.balance();
      for (let x = 0; x < count; x += 1) {
        const highBid = await burnAuction.highestBidPerRound(targetRound + x);
        balance = balance.clone().add(highBid.amount);
        await burnAuction.methods["updateBalance(uint256)"](0, {
          from: accounts[8]
        });
        const finalAmount = await burnAuction.balance();
        chai.assert(finalAmount.eq(balance), "Unexpected balance update");
      }
    });

    it("should safely accept large iteration value", async () => {
      const targetRound = +(await burnAuction.earliestBiddableRound());
      const count = 5;
      const finalRound = targetRound + count;
      // Bid a bunch of rounds in the future
      for (let x = 0; x < count; x += 1) {
        await burnAuction.bid(targetRound + x, {
          from: accounts[0],
          value: await burnAuction.minNextBid(targetRound + x)
        });
      }
      const startBlock = await burnAuction.calcRoundStart(targetRound - 1);
      while ((await web3.eth.getBlock("latest")).number < startBlock) {
        await timeMachine.advanceBlock();
      }
      // settle up to the targetRound
      await burnAuction.updateBalance({
        from: accounts[8]
      });
      const targetBlock = await burnAuction.calcRoundStart(finalRound);
      while ((await web3.eth.getBlock("latest")).number < targetBlock) {
        await timeMachine.advanceBlock();
      }
      const balance = await burnAuction.balance();
      let expectedProfit = new BN("0");
      for (let x = 0; x < count; x += 1) {
        const highBid = await burnAuction.highestBidPerRound(targetRound + x);
        expectedProfit = expectedProfit.clone().add(highBid.amount);
      }
      // Update some large number of iterations
      await burnAuction.methods["updateBalance(uint256)"](10000000000, {
        from: accounts[8]
      });
      const lastBalanceIndex = await burnAuction.lastBalanceIndex();
      chai.assert(
        +lastBalanceIndex === finalRound,
        "Not settled to current round"
      );
      const finalBalance = await burnAuction.balance();
      chai.assert(
        finalBalance.eq(balance.add(expectedProfit)),
        "Unexpected balance"
      );
    });

    it("should transfer balance", async () => {
      const receiver = accounts[7];
      const startBalance = new BN(
        await web3.eth.getBalance(receiver, "latest")
      );
      await burnAuction.updateBalance({
        from: accounts[8]
      });
      const contractBalance = await burnAuction.balance();
      await burnAuction.transferBalance(receiver, {
        from: accounts[8]
      });
      const balance = new BN(await web3.eth.getBalance(receiver, "latest"));
      chai.assert(
        startBalance.add(contractBalance).eq(balance),
        "Funds were not received"
      );
      const newContractBalance = await burnAuction.balance();
      chai.assert(
        newContractBalance.eq(new BN("0")),
        "Not all funds were moved"
      );
    });
  });

  describe("round tests", () => {
    it("should propose if winning bid", async () => {
      const currentRound = +(await burnAuction.currentRound()).toString();
      const roundStartBlock = +(
        await burnAuction.calcRoundStart(currentRound)
      ).toString();
      const targetRound = +(
        await burnAuction.roundForBlock(
          roundStartBlock + roundLength + auctionEnd
        )
      ).toString();
      const targetRoundStart = +(
        await burnAuction.calcRoundStart(targetRound)
      ).toString();
      const bidAmount = await burnAuction.minNextBid(targetRound);
      await burnAuction.bid(targetRound, {
        from: accounts[0],
        value: bidAmount
      });
      while ((await web3.eth.getBlock("latest")).number < targetRoundStart) {
        await timeMachine.advanceBlock();
      }
      chai.assert(
        +(await burnAuction.currentRound()).toString() === targetRound
      );
      chai.assert(await burnAuction.isProposable(accounts[0]));
      chai.assert(!(await burnAuction.isProposable(accounts[1])));
    });

    it("should propose if no winning bid", async () => {
      const currentRound = +(await burnAuction.currentRound()).toString();
      let targetRound = 0;
      // find a round that has no bids
      for (let x = currentRound + 1; true; x += 1) {
        const highBid = await burnAuction.highestBidPerRound(x);
        // eslint-disable-next-line jest/no-if
        if (highBid.amount.eq(new BN("0"))) {
          targetRound = x;
          break;
        }
      }
      const targetRoundStart = +(
        await burnAuction.calcRoundStart(targetRound)
      ).toString();
      while ((await web3.eth.getBlock("latest")).number < targetRoundStart) {
        await timeMachine.advanceBlock();
      }
      chai.assert(
        +(await burnAuction.currentRound()).toString() === targetRound
      );
      chai.assert(await burnAuction.isProposable(accounts[0]));
      chai.assert(await burnAuction.isProposable(accounts[1]));
      chai.assert(await burnAuction.isProposable(accounts[2]));
    });
  });

  describe("lock tests", () => {
    it("should fail to lock", async () => {
      const currentRound = +(await burnAuction.currentRound()).toString();
      const roundStartBlock = +(
        await burnAuction.calcRoundStart(currentRound)
      ).toString();
      const targetRound = +(
        await burnAuction.roundForBlock(
          roundStartBlock + roundLength + auctionStart - 1
        )
      ).toString();
      try {
        await zkopru.lock(targetRound, {
          from: accounts[0]
        });
        chai.assert(false, "Should fail to lock");
      } catch (err) {
        chai.assert(
          err.reason ===
            "BurnAuction: Round index is not far enough in the future"
        );
      }
    });

    it("should lock", async () => {
      const currentRound = +(await burnAuction.currentRound()).toString();
      const roundStartBlock = +(
        await burnAuction.calcRoundStart(currentRound)
      ).toString();
      const targetRound = +(
        await burnAuction.roundForBlock(
          roundStartBlock + roundLength + auctionStart + 1
        )
      ).toString();
      await zkopru.lock(targetRound, {
        from: accounts[0]
      });
      const lockedRound = +(await burnAuction.lockedRoundIndex()).toString();
      chai.assert(lockedRound === targetRound, "Locked round incorrect");
      for (let x = 0; x < roundLength; x += 1) {
        await timeMachine.advanceBlock();
      }
      try {
        await burnAuction.bid(lockedRound, {
          from: accounts[5]
        });
        chai.assert(false, "Should fail to bid on locked round");
      } catch (err) {
        chai.assert(err.reason === "BurnAuction: Contract is locked");
      }
    });

    it("should fail to double lock", async () => {
      const currentRound = +(await burnAuction.currentRound()).toString();
      const roundStartBlock = +(
        await burnAuction.calcRoundStart(currentRound)
      ).toString();
      const targetRound = +(
        await burnAuction.roundForBlock(
          roundStartBlock + roundLength + auctionStart + 1
        )
      ).toString();
      try {
        await zkopru.lock(targetRound, {
          from: accounts[0]
        });
        chai.assert(false, "Double lock should fail");
      } catch (err) {
        chai.assert(err.reason === "BurnAuction: Contract already locked");
      }
    });
  });
});
