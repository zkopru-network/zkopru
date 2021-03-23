/* eslint-disable no-unused-expressions */
/* eslint-disable jest/prefer-todo */
/* eslint-disable jest/require-top-level-describe */
/* eslint-disable jest/consistent-test-it */
const chai = require("chai");
const { getDummyBlock } = require("~dataset/testset-block");
const {
  serializeHeader,
  serializeBody,
  serializeFinalization
} = require("~core");
const { Fp } = require("~babyjubjub");

const { expect } = chai;

const DeserializationTester = artifacts.require("DeserializationTester");

const compare = (actual, expected) => {
  expect(Fp.from(actual.toString()).toHex()).equal(
    Fp.from(expected.toString()).toHex()
  );
};

contract("Finalization serialize-deserialize tests", async accounts => {
  let header;
  let block;
  let body;
  let rawData;
  let finalization;
  let dt;
  before(async () => {
    dt = await DeserializationTester.new(accounts[0]);
    block = await getDummyBlock();
    header = block.header;
    body = block.body;
    finalization = block.getFinalization();
    rawData = serializeFinalization(finalization);
  });
  describe("header test", () => {
    it("should have correct checksum", async () => {
      const checksum = await dt.getProposalChecksum(block.serializeBlock());
      compare(finalization.proposalChecksum.toString(), checksum);
    });
    it("should have correct proposer", async () => {
      const proposer = await dt.getProposerFromFinalization(rawData);
      compare(header.proposer, proposer);
    });
    it("should have correct proposer even it accepts extra parameters", async () => {
      const proposer = await dt.getProposer2FromFinalization(0, 0, rawData);
      compare(header.proposer, proposer);
    });
    it("should have correct parent block", async () => {
      const parentBlock = await dt.getParentBlockFromFinalization(rawData);
      compare(header.parentBlock, parentBlock);
    });
    it("should have correct parent block even it accepts extra parameters", async () => {
      const parentBlock = await dt.getParentBlock2FromFinalization(
        0,
        0,
        0,
        rawData
      );
      compare(header.parentBlock, parentBlock);
    });
    it("should have correct utxo rollup", async () => {
      const { root, index } = await dt.getUTXORollUpFromFinalization(rawData);
      compare(header.utxoRoot, root);
      compare(header.utxoIndex, index);
    });
    it("should have correct nullifier rollup", async () => {
      const root = await dt.getNullifierRollUpFromFinalization(rawData);
      compare(header.nullifierRoot, root);
    });
    it("should have correct withdrawal rollup", async () => {
      const { root, index } = await dt.getWithdrawalRollUpFromFinalization(
        rawData
      );
      compare(header.withdrawalRoot, root);
      compare(header.withdrawalIndex, index);
    });
    it("should have correct tx root", async () => {
      const txRoot = await dt.getTxRootFromFinalization(rawData);
      compare(header.txRoot, txRoot);
    });
    it("should have correct mass deposit root", async () => {
      const mdRoot = await dt.getMassDepositRootFromFinalization(rawData);
      compare(header.depositRoot, mdRoot);
      const computedMdRoot = await dt.computeDepositRootFromFinalization(
        rawData
      );
      console.log("l1 computed", computedMdRoot.toString());
      console.log("l2 computed", header.depositRoot.toString());
      compare(header.depositRoot, computedMdRoot);
    });
    it("should have correct mass migration root", async () => {
      const mmRoot = await dt.getMassMigrationRootFromFinalization(rawData);
      compare(header.migrationRoot, mmRoot);
      const computedMMRoot = await dt.computeMigrationRootFromFinalization(
        rawData
      );
      compare(header.migrationRoot, computedMMRoot);
    });
  });
  describe("body massDeposits", () => {
    it("should have correct mass deposit array length", async () => {
      const len = await dt.getMassDepositsLenFromFinalization(rawData);
      // eslint-disable-next-line no-unused-expressions
      compare(len, body.massDeposits.length);
    });
    it("should have correct mass deposit data", async () => {
      for (let index = 0; index < body.massDeposits.length; index += 1) {
        const { merged, fee } = await dt.getMassDepositFromFinalization(
          index,
          rawData
        );
        compare(merged, body.massDeposits[index].merged);
        compare(fee, body.massDeposits[index].fee);
      }
    });
  });
  describe("body massMigrations", () => {
    it("should have correct mass migration array length", async () => {
      const len = await dt.getMassMigrationsLenFromFinalization(rawData);
      // eslint-disable-next-line no-unused-expressions
      compare(len, body.massMigrations.length);
    });
    it("should have correct mass migration data", async () => {
      for (let index = 0; index < body.massMigrations.length; index += 1) {
        const {
          destination,
          totalETH,
          merged,
          fee
        } = await dt.getMassMigrationFromFinalization(index, rawData);
        compare(destination, body.massMigrations[index].destination);
        compare(totalETH, body.massMigrations[index].totalETH);
        compare(merged, body.massMigrations[index].migratingLeaves.merged);
        compare(fee, body.massMigrations[index].migratingLeaves.fee);
      }
    });
    it("should have correct erc20 mass migration data", async () => {
      for (let index = 0; index < body.massMigrations.length; index += 1) {
        const { erc20 } = body.massMigrations[index];
        for (let j = 0; j < erc20.length; j += 1) {
          const { token, amount } = await dt.getERC20MigrationFromFinalization(
            index,
            j,
            rawData
          );
          compare(token, erc20[j].addr);
          compare(amount, erc20[j].amount);
        }
      }
    });
    it("should have correct erc721 mass migration data", async () => {
      for (let index = 0; index < body.massMigrations.length; index += 1) {
        const { erc721 } = body.massMigrations[index];
        for (let j = 0; j < erc721.length; j += 1) {
          const { token, nfts } = await dt.getERC721MigrationFromFinalization(
            index,
            j,
            rawData
          );
          compare(token, erc721[j].addr);
          compare(nfts.length, erc721[j].nfts.length);
          for (let k = 0; k < erc721[j].nfts.length; k += 1) {
            compare(nfts[k], erc721[j].nfts[k]);
          }
        }
      }
    });
  });
});
