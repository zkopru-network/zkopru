import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import { BigNumber } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { BurnAuctionTester, ZkopruStubTester } from "../typechain";
import { Context, ZkopruTestFixture } from "./fixtures";

const { expect } = chai;

describe("burnAuction tests", () => {
  const context = new Context();
  let fixtures: ZkopruTestFixture;
  let accounts: SignerWithAddress[];
  let burnAuction: BurnAuctionTester;
  let zkopru: ZkopruStubTester;
  let roundLength: number;
  let auctionStart: number;
  let auctionEnd: number;
  before(async () => {
    fixtures = await context.getFixtures();
    accounts = await ethers.getSigners();
    burnAuction = fixtures.burnAuctionTester;
    zkopru = fixtures.zkopruStubTester;
    await zkopru.setConsensusProvider(burnAuction.address);
    roundLength = await burnAuction.roundLength();
    auctionStart = await burnAuction.auctionStart();
    auctionEnd = await burnAuction.auctionEnd();
    // Set the url so bids succeed
    await burnAuction.connect(accounts[0]).setUrl("localhost:8080");
    await burnAuction.connect(accounts[1]).setUrl("localhost");
  });

  describe("biddable rounds", () => {
    it("should return nearest biddable round", async () => {
      const round = await burnAuction.earliestBiddableRound();
      await burnAuction.connect(accounts[0])["bid(uint256)"](round, {
        value: await burnAuction.minNextBid(round)
      });
      await burnAuction.connect(accounts[0])["bid(uint256)"](+round + 1, {
        value: await burnAuction.minNextBid(+round + 1)
      });
      await expect(
        burnAuction.connect(accounts[0])["bid(uint256)"](+round - 1, {
          value: await burnAuction.minNextBid(+round - 1)
        })
      ).to.be.revertedWith("BurnAuction: Bid is too close to round start");
    });

    it("should return furthest biddable round", async () => {
      const round = await burnAuction.latestBiddableRound();
      await burnAuction.connect(accounts[0])["bid(uint256)"](round, {
        value: await burnAuction.minNextBid(round)
      });
      await burnAuction.connect(accounts[0])["bid(uint256)"](+round - 1, {
        value: await burnAuction.minNextBid(+round - 1)
      });
      await expect(
        burnAuction.connect(accounts[0])["bid(uint256)"](+round + 1, {
          value: await burnAuction.minNextBid(+round + 1)
        })
      ).to.be.revertedWith("BurnAuction: Bid is too far from round start");
    });
  });

  describe("bidding test", () => {
    it("should fail to bid on 0th auction", async () => {
      const currentRound = +(await burnAuction.currentRound()).toNumber();
      await expect(
        burnAuction.connect(accounts[0])["bid(uint256)"](currentRound, {})
      ).to.be.revertedWith("BurnAuction: Round is in past");
    });

    it("should fail to bid on auction too close", async () => {
      const currentRound = +(await burnAuction.currentRound()).toNumber();
      const roundStartBlock = +(
        await burnAuction.calcRoundStart(currentRound)
      ).toNumber();
      const targetRound = +(
        await burnAuction.roundForBlock(
          roundStartBlock + roundLength + auctionEnd - 1
        )
      ).toNumber();
      await expect(
        burnAuction.connect(accounts[0])["bid(uint256)"](targetRound, {})
      ).to.be.revertedWith("BurnAuction: Bid is too close to round start");
    });

    it("should fail to bid on auction too far", async () => {
      const currentRound = +(await burnAuction.currentRound()).toNumber();
      const roundStartBlock = +(
        await burnAuction.calcRoundStart(currentRound)
      ).toNumber();
      const targetRound = +(
        await burnAuction.roundForBlock(
          roundStartBlock + roundLength + auctionStart
        )
      ).toNumber();
      await expect(
        burnAuction.connect(accounts[0])["bid(uint256)"](targetRound, {})
      ).to.be.revertedWith("BurnAuction: Bid is too far from round start");
    });

    it("should fail to bid without funds", async () => {
      await burnAuction.connect(accounts[0])["refund()"]();
      const targetRound = await burnAuction.earliestBiddableRound();
      const bidAmount = parseEther("1"); // 1 ether
      await expect(
        burnAuction
          .connect(accounts[0])
          ["bid(uint256,uint256)"](targetRound, bidAmount)
      ).to.be.reverted;
    });

    it("should fail to pay overloaded bid function", async () => {
      await burnAuction.connect(accounts[0])["refund()"]();
      const targetRound = await burnAuction.earliestBiddableRound();
      const bidAmount = parseEther("1"); // 1 ether
      await expect(
        burnAuction
          .connect(accounts[0])
          ["bid(uint256,uint256)"](targetRound, bidAmount)
      ).to.be.reverted;
    });

    it("should fail to bid on past auction", async () => {
      await expect(
        burnAuction.connect(accounts[0])["bid(uint256)"](0, {})
      ).to.be.revertedWith("BurnAuction: Round is in past");
    });

    it("should fail to bid if no url", async () => {
      const currentRound = +(await burnAuction.currentRound()).toNumber();
      const roundStartBlock = +(
        await burnAuction.calcRoundStart(currentRound)
      ).toNumber();
      const targetRound = +(
        await burnAuction.roundForBlock(
          roundStartBlock + roundLength + auctionEnd + 1
        )
      ).toNumber();
      const bidAmount = await burnAuction.minNextBid(targetRound);
      await expect(
        burnAuction.connect(accounts[9])["bid(uint256)"](targetRound, {
          value: bidAmount
        })
      ).to.be.revertedWith("BurnAuction: Coordinator url not set");
    });

    it("should bid on near auction", async () => {
      const targetRound = +(await burnAuction.earliestBiddableRound());
      await burnAuction.connect(accounts[1])["bid(uint256)"](targetRound, {
        value: await burnAuction.minNextBid(targetRound)
      });
      const originalBalance = await burnAuction.pendingBalances(
        accounts[0].address
      );
      const bidAmount = await burnAuction.minNextBid(targetRound);
      await burnAuction.connect(accounts[0])["bid(uint256)"](targetRound, {
        value: bidAmount
      });
      const newBalance = await burnAuction.pendingBalances(accounts[0].address);
      chai.assert(originalBalance.eq(newBalance), "Pending balance incorrect");
      const highBid = await burnAuction.highestBidPerRound(targetRound);
      chai.assert.equal(
        highBid.owner,
        accounts[0].address,
        "Incorrect high bid owner"
      );
      chai.assert(highBid.amount.eq(bidAmount), "Incorrect high bid amount");
    });

    it("should bid on far auction", async () => {
      const targetRound = +(await burnAuction.latestBiddableRound());
      await burnAuction.connect(accounts[1])["bid(uint256)"](targetRound, {
        value: await burnAuction.minNextBid(targetRound)
      });
      const bidAmount = await burnAuction.minNextBid(targetRound);
      const originalBalance = await burnAuction.pendingBalances(
        accounts[0].address
      );
      await burnAuction.connect(accounts[0])["bid(uint256)"](targetRound, {
        value: bidAmount
      });
      const newBalance = await burnAuction.pendingBalances(accounts[0].address);
      chai.assert(originalBalance.eq(newBalance), "Pending balance incorrect");
      const highBid = await burnAuction.highestBidPerRound(targetRound);
      chai.assert.equal(
        highBid.owner,
        accounts[0].address,
        "Incorrect high bid owner"
      );
      chai.assert(highBid.amount.eq(bidAmount), "Incorrect high bid amount");
    });

    it("should fail to bid too little", async () => {
      const currentRound = +(await burnAuction.currentRound()).toNumber();
      const roundStartBlock = +(
        await burnAuction.calcRoundStart(currentRound)
      ).toNumber();
      const targetRound = +(
        await burnAuction.roundForBlock(
          roundStartBlock + roundLength + auctionStart / 2
        )
      ).toNumber();
      const bidAmount = (await burnAuction.minNextBid(targetRound)).sub(1);
      await expect(
        burnAuction.connect(accounts[0])["bid(uint256)"](targetRound, {
          value: bidAmount
        })
      ).to.be.revertedWith("BurnAuction: Bid not high enough");
    });

    it("should have valid minimum bid", async () => {
      const currentRound = +(await burnAuction.currentRound()).toNumber();
      const roundStartBlock = +(
        await burnAuction.calcRoundStart(currentRound)
      ).toNumber();
      // find a round without a bid
      const targetRound = +(
        await burnAuction.roundForBlock(
          roundStartBlock + roundLength + auctionStart / 2 + 10000
        )
      ).toNumber();
      const bid = await burnAuction.highestBidPerRound(targetRound);
      chai.assert(bid.amount.isZero());
      const minBid = await burnAuction.minBid();
      {
        const minNextBid = await burnAuction.minNextBid(targetRound);
        chai.assert(minNextBid.gt(minBid));
      }
      const bidAmount = minBid.mul(2);
      // Do the bid, then test again
      await burnAuction.connect(accounts[0])["bid(uint256)"](targetRound, {
        value: bidAmount
      });
      {
        const minNextBid = await burnAuction.minNextBid(targetRound);
        chai.assert(minNextBid.gt(bidAmount));
      }
    });

    it("should refund bid when outbid", async () => {
      const currentRound = +(await burnAuction.currentRound()).toNumber();
      const roundStartBlock = +(
        await burnAuction.calcRoundStart(currentRound)
      ).toNumber();
      const targetRound = +(
        await burnAuction.roundForBlock(
          roundStartBlock + roundLength + auctionStart / 2
        )
      ).toNumber();
      const bidAmount = await burnAuction.minNextBid(targetRound);
      // Do first bid
      const originalBalance = await burnAuction.pendingBalances(
        accounts[0].address
      );
      await burnAuction.connect(accounts[0])["bid(uint256)"](targetRound, {
        value: bidAmount
      });
      const nextBidAmount = await burnAuction.minNextBid(targetRound);
      await burnAuction.connect(accounts[1])["bid(uint256)"](targetRound, {
        value: nextBidAmount
      });
      const newBalance = await burnAuction.pendingBalances(accounts[0].address);
      chai.assert(originalBalance.add(bidAmount).eq(newBalance));
    });
  });

  describe("multibid test", () => {
    it("should fail to bid on invalid auctions", async () => {
      const startRound = +(await burnAuction.earliestBiddableRound()) - 1;
      const endRound = startRound + 10;
      const maxBid = parseEther("1"); // 1 ether
      await expect(
        burnAuction
          .connect(accounts[0])
          .multiBid(0, maxBid, startRound, endRound, {
            value: parseEther("1")
          })
      ).to.be.revertedWith("BurnAuction: Bid is too close to round start");
    });

    it("should store leftover funds in balance", async () => {
      const startRound = await burnAuction.earliestBiddableRound();
      const endRound = +startRound + 10;
      const maxBid = parseEther("1"); // 1 ether
      await burnAuction
        .connect(accounts[1])
        .multiBid(0, maxBid, startRound, endRound, {
          value: maxBid
        });
      const startBalance = await burnAuction.pendingBalances(
        accounts[0].address
      );
      let expectedTotalBid = BigNumber.from(0);
      for (let x = +startRound; x <= +endRound; x += 1) {
        expectedTotalBid = expectedTotalBid.add(
          await burnAuction.minNextBid(x)
        );
      }
      await burnAuction
        .connect(accounts[0])
        .multiBid(0, maxBid, startRound, endRound, {
          value: maxBid
        });
      const finalBalance = await burnAuction.pendingBalances(
        accounts[0].address
      );
      chai.assert(
        finalBalance.eq(startBalance.add(maxBid).sub(expectedTotalBid)),
        "Final balance is incorrect"
      );
    });

    it("should bid until out of funds", async () => {
      const startRound = await burnAuction.earliestBiddableRound();
      const endRound = +startRound + 10;
      const maxBid = parseEther("1"); // 1 ether
      await burnAuction
        .connect(accounts[1])
        .multiBid(0, maxBid, startRound, endRound, {
          value: maxBid
        });
      await burnAuction.connect(accounts[0])["refund()"]();
      const minBid = parseEther("0.1"); // 0.1 ether
      const bidCount = 3;
      await burnAuction
        .connect(accounts[0])
        .multiBid(minBid, maxBid, startRound, endRound, {
          value: minBid.mul(bidCount) // Only bid on bidCount rounds
        });
      for (let x = +startRound; x < +startRound + bidCount; x += 1) {
        const highBid = await burnAuction.highestBidPerRound(x);
        chai.assert(
          highBid.owner === accounts[0].address,
          `Expected account 0 to be round owner for round ${x}`
        );
      }
      for (let x = +startRound + bidCount; x <= +endRound; x += 1) {
        const highBid = await burnAuction.highestBidPerRound(x);
        chai.assert(
          highBid.owner === accounts[1].address,
          `Expected account 1 to be round owner for round ${x}`
        );
      }
      const finalBalance = await burnAuction.pendingBalances(
        accounts[0].address
      );
      chai.assert(finalBalance.isZero(), "Incorrect final balance");
    });
  });

  describe("url test", () => {
    it("should set url", async () => {
      const url = "localhost";
      await burnAuction.connect(accounts[1]).setUrl(url);
      const networkUrl = await burnAuction.coordinatorUrls(accounts[1].address);
      chai.assert(
        networkUrl === url,
        `Network url incorrect, expected ${url} got ${networkUrl}`
      );
    });

    it("should clear url", async () => {
      const url = "localhost";
      await burnAuction.connect(accounts[1]).setUrl(url);
      const networkUrl = await burnAuction.coordinatorUrls(accounts[1].address);
      chai.assert(
        networkUrl === url,
        `First network url incorrect, expected ${url} got ${networkUrl}`
      );
      await burnAuction.connect(accounts[1]).clearUrl();
      const newNetworkUrl = await burnAuction.coordinatorUrls(
        accounts[1].address
      );
      chai.assert(
        newNetworkUrl === "",
        `Second network url incorrect, expected nothing got ${newNetworkUrl}`
      );
    });
  });

  describe("refund test", () => {
    it("should refund empty balance", async () => {
      const contractBalance = await ethers.provider.getBalance(
        burnAuction.address
      );
      await burnAuction.connect(accounts[9])["refund()"]();
      const newContractBalance = await ethers.provider.getBalance(
        burnAuction.address
      );
      chai.assert(
        contractBalance.eq(newContractBalance),
        "Contract balance should not change"
      );
    });

    it("should refund balance once", async () => {
      const currentRound = +(await burnAuction.currentRound()).toNumber();
      const roundStartBlock = +(
        await burnAuction.calcRoundStart(currentRound)
      ).toNumber();
      const targetRound = +(
        await burnAuction.roundForBlock(
          roundStartBlock + roundLength + auctionStart / 2
        )
      ).toNumber();
      await burnAuction.connect(accounts[3]).setUrl("localhost", {});
      await burnAuction.connect(accounts[3])["bid(uint256)"](targetRound, {
        value: await burnAuction.minNextBid(targetRound)
      });
      // outbid self to get a pending balance
      await burnAuction.connect(accounts[3])["bid(uint256)"](targetRound, {
        value: await burnAuction.minNextBid(targetRound)
      });
      const pendingBalance = await burnAuction.pendingBalances(
        accounts[3].address
      );
      const addressBalance = await ethers.provider.getBalance(
        accounts[3].address
      );
      // Use alt account to avoid gas cost calculation
      await burnAuction
        .connect(accounts[9])
        ["refund(address)"](accounts[3].address);
      const finalBalance = await ethers.provider.getBalance(
        accounts[3].address
      );
      chai.assert(addressBalance.add(pendingBalance).eq(finalBalance));
      const newPendingBalance = await burnAuction.pendingBalances(
        accounts[3].address
      );
      chai.assert(newPendingBalance.isZero());
      await burnAuction
        .connect(accounts[9])
        ["refund(address)"](accounts[3].address);
      const finalBalance2 = await ethers.provider.getBalance(
        accounts[3].address
      );
      chai.assert(finalBalance2.eq(finalBalance));
    });
  });

  describe("open round tests", () => {
    it("should not open round", async () => {
      const currentRound = +(await burnAuction.currentRound()).toNumber();
      const roundStartBlock = +(
        await burnAuction.calcRoundStart(currentRound)
      ).toNumber();
      const targetRound = +(
        await burnAuction.roundForBlock(
          roundStartBlock + roundLength + auctionEnd
        )
      ).toNumber();
      const targetRoundStart = +(
        await burnAuction.calcRoundStart(targetRound)
      ).toNumber();
      const bidAmount = await burnAuction.minNextBid(targetRound);
      await burnAuction.connect(accounts[5]).setUrl("localhost");
      await burnAuction.connect(accounts[5])["bid(uint256)"](targetRound, {
        value: bidAmount
      });
      // advance the blockchain
      while (
        (await ethers.provider.getBlock("latest")).number < targetRoundStart
      ) {
        await context.advanceBlock();
      }
      chai.assert(
        +(await burnAuction.currentRound()).toNumber() === targetRound
      );
      // now we're in the round controlled by accounts[5]
      chai.assert(!(await burnAuction.isRoundOpen()), "Round is already open");
      await burnAuction.connect(accounts[0]).openRoundIfNeeded();
      chai.assert(
        !(await burnAuction.isRoundOpen()),
        "Round should not be opened"
      );
      await zkopru.propose(accounts[5].address);
      // advance the blockchain further
      while (
        (await ethers.provider.getBlock("latest")).number <
        targetRoundStart + roundLength / 2
      ) {
        await context.advanceBlock();
      }
      await burnAuction.connect(accounts[0]).openRoundIfNeeded();
      chai.assert(
        !(await burnAuction.isRoundOpen()),
        "Round should not be opened after half"
      );
    });

    it("should open round if no proposed block in first half", async () => {
      const currentRound = +(await burnAuction.currentRound()).toNumber();
      const roundStartBlock = +(
        await burnAuction.calcRoundStart(currentRound)
      ).toNumber();
      const targetRound = +(
        await burnAuction.roundForBlock(
          roundStartBlock + roundLength + auctionEnd
        )
      ).toNumber();
      const targetRoundStart = +(
        await burnAuction.calcRoundStart(targetRound)
      ).toNumber();
      const bidAmount = await burnAuction.minNextBid(targetRound);
      await burnAuction.connect(accounts[5])["bid(uint256)"](targetRound, {
        value: bidAmount
      });
      // advance the blockchain
      while (
        (await ethers.provider.getBlock("latest")).number < targetRoundStart
      ) {
        await context.advanceBlock();
      }
      chai.assert(
        +(await burnAuction.currentRound()).toNumber() === targetRound
      );
      // now we're in the round controlled by accounts[5]
      chai.assert(!(await burnAuction.isRoundOpen()), "Round is already open");
      await burnAuction.connect(accounts[0]).openRoundIfNeeded();
      chai.assert(
        !(await burnAuction.isRoundOpen()),
        "Round should not be opened"
      );
      // advance the blockchain past halfway point
      while (
        (await ethers.provider.getBlock("latest")).number <
        targetRoundStart + roundLength / 2
      ) {
        await context.advanceBlock();
      }
      await burnAuction.connect(accounts[0]).openRoundIfNeeded();
      chai.assert(
        await burnAuction.isRoundOpen(),
        "Round should be opened after half"
      );
    });
  });

  describe("balance tests", () => {
    it("should update balance", async () => {
      const currentRound = +(await burnAuction.currentRound()).toNumber();
      // calculate the expected balance here
      let balance = BigNumber.from(0);
      for (let x = 0; x <= currentRound; x += 1) {
        const highBid = await burnAuction.highestBidPerRound(x);
        balance = balance.add(highBid.amount);
      }
      const startBalance = await burnAuction.balance();
      chai.assert(startBalance.isZero(), "Contract balance is non-zero");
      await burnAuction.connect(accounts[8])["updateBalance()"]();
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
        await burnAuction
          .connect(accounts[0])
          ["bid(uint256)"](targetRound + x, {
            value: bidAmount
          });
      }
      const targetBlock = await burnAuction.calcRoundStart(finalRound);
      while (
        (await ethers.provider.getBlock("latest")).number <
        targetBlock.toNumber()
      ) {
        await context.advanceBlock();
      }
      const currentRound2 = +(await burnAuction.currentRound());
      const lastBalanceUpdate = +(await burnAuction.lastBalanceIndex());
      let balance = BigNumber.from(0);
      // Calculate the balance change
      for (let x = lastBalanceUpdate + 1; x <= currentRound2; x += 1) {
        const highBid = await burnAuction.highestBidPerRound(x);
        balance = balance.add(highBid.amount);
      }
      const startBalance = await burnAuction.balance();
      await burnAuction.connect(accounts[8])["updateBalance()"]();
      const newBalance = await burnAuction.balance();
      const expectedBalance = balance.add(startBalance);
      chai.assert(
        newBalance.eq(expectedBalance),
        `Incorrect balance, expected ${expectedBalance.toString()} got ${newBalance.toString()}`
      );
      // Jump further in the future
      const targetBlock2 = (
        await burnAuction.calcRoundStart(finalRound + 5)
      ).toNumber();
      while ((await ethers.provider.getBlock("latest")).number < targetBlock2) {
        await context.advanceBlock();
      }
      const currentRound3 = +(await burnAuction.currentRound()).toNumber();
      const newLastBalanceUpdate = +(await burnAuction.lastBalanceIndex());
      // calculate the balance change
      for (let x = newLastBalanceUpdate + 1; x <= currentRound3; x += 1) {
        const highBid = await burnAuction.highestBidPerRound(x);
        balance = balance.add(highBid.amount);
      }
      await burnAuction.connect(accounts[8])["updateBalance()"]();
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
        await burnAuction
          .connect(accounts[0])
          ["bid(uint256)"](targetRound + x, {
            value: await burnAuction.minNextBid(targetRound + x)
          });
      }
      const startBlock = await burnAuction.calcRoundStart(targetRound - 1);
      while (
        (await ethers.provider.getBlock("latest")).number <
        startBlock.toNumber()
      ) {
        await context.advanceBlock();
      }
      // settle up to the targetRound
      await burnAuction.connect(accounts[8])["updateBalance()"]();
      const targetBlock = await burnAuction.calcRoundStart(finalRound);
      while (
        (await ethers.provider.getBlock("latest")).number <
        targetBlock.toNumber()
      ) {
        await context.advanceBlock();
      }
      let balance = await burnAuction.balance();
      for (let x = 0; x < count; x += 1) {
        const highBid = await burnAuction.highestBidPerRound(targetRound + x);
        balance = balance.add(highBid.amount);
        await burnAuction.connect(accounts[8])["updateBalance(uint256)"](0);
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
        await burnAuction
          .connect(accounts[0])
          ["bid(uint256)"](targetRound + x, {
            value: await burnAuction.minNextBid(targetRound + x)
          });
      }
      const startBlock = await burnAuction.calcRoundStart(targetRound - 1);
      while (
        (await ethers.provider.getBlock("latest")).number <
        startBlock.toNumber()
      ) {
        await context.advanceBlock();
      }
      // settle up to the targetRound
      await burnAuction.connect(accounts[8])["updateBalance()"]();
      const targetBlock = await burnAuction.calcRoundStart(finalRound);
      while (
        (await ethers.provider.getBlock("latest")).number <
        targetBlock.toNumber()
      ) {
        await context.advanceBlock();
      }
      const balance = await burnAuction.balance();
      let expectedProfit = BigNumber.from(0);
      for (let x = 0; x < count; x += 1) {
        const highBid = await burnAuction.highestBidPerRound(targetRound + x);
        expectedProfit = expectedProfit.add(highBid.amount);
      }
      // Update some large number of iterations
      await burnAuction
        .connect(accounts[8])
        ["updateBalance(uint256)"](10000000000, {});
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
      const startBalance = await ethers.provider.getBalance(
        receiver.address,
        "latest"
      );
      await burnAuction.connect(accounts[8])["updateBalance()"]();
      const contractBalance = await burnAuction.balance();
      // only the owner can transfer balance
      await burnAuction.connect(accounts[0]).transferBalance(receiver.address);
      const balance = await ethers.provider.getBalance(
        receiver.address,
        "latest"
      );
      chai.assert(
        startBalance.add(contractBalance).eq(balance),
        "Funds were not received"
      );
      const newContractBalance = await burnAuction.balance();
      chai.assert(newContractBalance.isZero(), "Not all funds were moved");
    });
  });

  describe("round tests", () => {
    it("should propose if winning bid", async () => {
      const currentRound = +(await burnAuction.currentRound()).toNumber();
      const roundStartBlock = +(
        await burnAuction.calcRoundStart(currentRound)
      ).toNumber();
      const targetRound = +(
        await burnAuction.roundForBlock(
          roundStartBlock + roundLength + auctionEnd
        )
      ).toNumber();
      const targetRoundStart = +(
        await burnAuction.calcRoundStart(targetRound)
      ).toNumber();
      const bidAmount = await burnAuction.minNextBid(targetRound);
      await burnAuction.connect(accounts[0])["bid(uint256)"](targetRound, {
        value: bidAmount
      });
      while (
        (await ethers.provider.getBlock("latest")).number < targetRoundStart
      ) {
        await context.advanceBlock();
      }
      chai.assert(
        +(await burnAuction.currentRound()).toNumber() === targetRound
      );
      chai.assert(await burnAuction.isProposable(accounts[0].address));
      chai.assert(!(await burnAuction.isProposable(accounts[1].address)));
    });

    it("should propose if no winning bid", async () => {
      const currentRound = +(await burnAuction.currentRound()).toNumber();
      let targetRound = 0;
      // find a round that has no bids
      for (let x = currentRound + 1; true; x += 1) {
        const highBid = await burnAuction.highestBidPerRound(x);
        // eslint-disable-next-line jest/no-if
        if (highBid.amount.isZero()) {
          targetRound = x;
          break;
        }
      }
      const targetRoundStart = +(
        await burnAuction.calcRoundStart(targetRound)
      ).toNumber();
      while (
        (await ethers.provider.getBlock("latest")).number < targetRoundStart
      ) {
        await context.advanceBlock();
      }
      chai.assert(
        +(await burnAuction.currentRound()).toNumber() === targetRound
      );
      chai.assert(await burnAuction.isProposable(accounts[0].address));
      chai.assert(await burnAuction.isProposable(accounts[1].address));
      chai.assert(await burnAuction.isProposable(accounts[2].address));
    });
  });

  describe("lock tests", () => {
    it("should fail to lock", async () => {
      const currentRound = +(await burnAuction.currentRound()).toNumber();
      const roundStartBlock = +(
        await burnAuction.calcRoundStart(currentRound)
      ).toNumber();
      const targetRound = +(
        await burnAuction.roundForBlock(
          roundStartBlock + roundLength + auctionStart - 1
        )
      ).toNumber();
      await expect(
        zkopru.connect(accounts[0]).lock(targetRound)
      ).to.be.revertedWith(
        "BurnAuction: Round index is not far enough in the future"
      );
    });

    it("should lock", async () => {
      const currentRound = +(await burnAuction.currentRound()).toNumber();
      const roundStartBlock = +(
        await burnAuction.calcRoundStart(currentRound)
      ).toNumber();
      const targetRound = +(
        await burnAuction.roundForBlock(
          roundStartBlock + roundLength + auctionStart + 1
        )
      ).toNumber();
      await zkopru.connect(accounts[0]).lock(targetRound);
      const lockedRound = +(await burnAuction.lockedRoundIndex()).toNumber();
      chai.assert(lockedRound === targetRound, "Locked round incorrect");
      for (let x = 0; x < roundLength; x += 1) {
        await context.advanceBlock();
      }
      await expect(
        burnAuction.connect(accounts[5])["bid(uint256)"](lockedRound)
      ).to.be.revertedWith("BurnAuction: Contract is locked");
    });

    it("should fail to double lock", async () => {
      const currentRound = +(await burnAuction.currentRound()).toNumber();
      const roundStartBlock = +(
        await burnAuction.calcRoundStart(currentRound)
      ).toNumber();
      const targetRound = +(
        await burnAuction.roundForBlock(
          roundStartBlock + roundLength + auctionStart + 1
        )
      ).toNumber();
      await expect(
        zkopru.connect(accounts[0]).lock(targetRound, {})
      ).to.be.revertedWith("BurnAuction: Contract already locked");
    });
  });
});
