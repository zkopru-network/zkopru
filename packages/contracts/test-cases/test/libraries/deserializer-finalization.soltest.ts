/* eslint-disable no-unused-expressions */
/* eslint-disable jest/prefer-todo */
/* eslint-disable jest/require-top-level-describe */
/* eslint-disable jest/consistent-test-it */
import { getDummyBlock } from "~dataset/testset-block";
import {
  Block,
  Header,
  Body,
  Finalization,
  serializeFinalization
} from "~core";
import { DeserializationTester } from "../../typechain";
import { Context, ZkopruTestFixture } from "../fixtures";
import { compare } from "../../helper";

describe("finalization serialize-deserialize tests", () => {
  let header: Header;
  let block: Block;
  let body: Body;
  let rawData: Buffer;
  let finalization: Finalization;
  let fixtures: ZkopruTestFixture;
  let dt: DeserializationTester;
  const context = new Context();
  before(async () => {
    fixtures = await context.getFixtures();
    dt = fixtures.deserializationTester;
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
});
