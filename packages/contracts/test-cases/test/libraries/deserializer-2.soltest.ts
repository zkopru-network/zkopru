/* eslint-disable no-unused-expressions */
/* eslint-disable jest/prefer-todo */
/* eslint-disable jest/require-top-level-describe */
/* eslint-disable jest/consistent-test-it */
import { Block, Body, Header } from "~core";
import { Fp } from "~babyjubjub";
import { Context, ZkopruTestFixture } from "../fixtures";
import { compare, sampleFirstBlock } from "../../helper";
import { DeserializationTester } from "../../typechain";

describe("block serialize-deserialize tests", () => {
  let header: Header;
  let body: Body;
  let block: Block;
  let fixtures: ZkopruTestFixture;
  let dt: DeserializationTester;
  const context = new Context();
  before(async () => {
    fixtures = await context.getFixtures();
    dt = fixtures.deserializationTester;
    block = Block.from(sampleFirstBlock);
    body = block.body;
    header = block.header;
  });
  describe("header test", () => {
    it("should have correct proposer", async () => {
      const proposer = await dt.getProposer(sampleFirstBlock);
      compare(header.proposer, proposer);
    });
    it("should have correct proposer even it accepts extra parameters", async () => {
      const proposer = await dt.getProposer2(0, 0, sampleFirstBlock);
      compare(header.proposer, proposer);
    });
    it("should have correct parent block", async () => {
      const parentBlock = await dt.getParentBlock(sampleFirstBlock);
      compare(header.parentBlock, parentBlock);
    });
    it("should have correct parent block even it accepts extra parameters", async () => {
      const parentBlock = await dt.getParentBlock2(0, 0, 0, sampleFirstBlock);
      compare(header.parentBlock, parentBlock);
    });
    it("should have correct utxo rollup", async () => {
      const { root, index } = await dt.getUTXORollUp(sampleFirstBlock);
      compare(header.utxoRoot, root);
      compare(header.utxoIndex, index);
    });
    it("should have correct nullifier rollup", async () => {
      const root = await dt.getNullifierRollUp(sampleFirstBlock);
      compare(header.nullifierRoot, root);
    });
    it("should have correct withdrawal rollup", async () => {
      const { root, index } = await dt.getWithdrawalRollUp(sampleFirstBlock);
      compare(header.withdrawalRoot, root);
      compare(header.withdrawalIndex, index);
    });
    it("should have correct tx root", async () => {
      const txRoot = await dt.getTxRoot(sampleFirstBlock);
      const computedTxRoot = await dt.computeTxRoot(sampleFirstBlock);
      compare(header.txRoot, txRoot);
      compare(header.txRoot, computedTxRoot);
    });
    it("should have correct mass deposit root", async () => {
      const mdRoot = await dt.getMassDepositRoot(sampleFirstBlock);
      compare(header.depositRoot, mdRoot);
      const computedMdRoot = await dt.computeDepositRoot(sampleFirstBlock);
      compare(header.depositRoot, computedMdRoot);
    });
    it("should have correct mass migration root", async () => {
      const mmRoot = await dt.getMassMigrationRoot(sampleFirstBlock);
      compare(header.migrationRoot, mmRoot);
      const computedMMRoot = await dt.computeMigrationRoot(sampleFirstBlock);
      compare(header.migrationRoot, computedMMRoot);
    });
  });
  describe("body txs", () => {
    it("should have correct tx array length", async () => {
      const txsLen = await dt.getTxsLen(sampleFirstBlock);
      // eslint-disable-next-line no-unused-expressions
      compare(txsLen, body.txs.length);
    });
    it("should have correct tx inflow data", async () => {
      for (let txIndex = 0; txIndex < body.txs.length; txIndex += 1) {
        for (
          let inflowIndex = 0;
          inflowIndex < body.txs[txIndex].inflow.length;
          inflowIndex += 1
        ) {
          const txInflow = await dt.getTxInflow(
            txIndex,
            inflowIndex,
            sampleFirstBlock
          );
          compare(
            txInflow.inclusionRoot,
            body.txs[txIndex].inflow[inflowIndex].root
          );
          compare(
            txInflow.nullifier,
            body.txs[txIndex].inflow[inflowIndex].nullifier
          );
        }
      }
    });
    it("should have correct tx outflow data", async () => {
      for (let txIndex = 0; txIndex < body.txs.length; txIndex += 1) {
        for (
          let outflowIndex = 0;
          outflowIndex < body.txs[txIndex].outflow.length;
          outflowIndex += 1
        ) {
          const txOutflow = await dt.getTxOutflow(
            txIndex,
            outflowIndex,
            sampleFirstBlock
          );
          compare(txOutflow.note, body.txs[txIndex].outflow[outflowIndex].note);
          const { data } = body.txs[txIndex].outflow[outflowIndex];
          compare(txOutflow.to, data ? data.to : Fp.zero);
          compare(txOutflow.eth, data ? data.eth : Fp.zero);
          compare(txOutflow.token, data ? data.tokenAddr : Fp.zero);
          compare(txOutflow.amount, data ? data.erc20Amount : Fp.zero);
          compare(txOutflow.nft, data ? data.nft : Fp.zero);
          compare(txOutflow.fee, data ? data.fee : Fp.zero);
        }
      }
    });
    it("should have correct tx fee", async () => {
      for (let txIndex = 0; txIndex < body.txs.length; txIndex += 1) {
        const txFee = await dt.getTxFee(txIndex, sampleFirstBlock);
        compare(body.txs[txIndex].fee, txFee);
      }
    });
    it("should have correct swap value", async () => {
      for (let txIndex = 0; txIndex < body.txs.length; txIndex += 1) {
        const txSwap = await dt.getTxSwap(txIndex, sampleFirstBlock);
        compare(body.txs[txIndex].swap || 0, txSwap);
      }
    });
    it("should have correct proof value", async () => {
      for (let txIndex = 0; txIndex < body.txs.length; txIndex += 1) {
        const proof = await dt.getProof(txIndex, sampleFirstBlock);
        compare(body.txs[txIndex].proof?.pi_a[0], proof[0]);
        compare(body.txs[txIndex].proof?.pi_a[1], proof[1]);
        // caution: snarkjs G2Point is reversed
        compare(body.txs[txIndex].proof?.pi_b[0][1], proof[2]);
        compare(body.txs[txIndex].proof?.pi_b[0][0], proof[3]);
        compare(body.txs[txIndex].proof?.pi_b[1][1], proof[4]);
        compare(body.txs[txIndex].proof?.pi_b[1][0], proof[5]);
        compare(body.txs[txIndex].proof?.pi_c[0], proof[6]);
        compare(body.txs[txIndex].proof?.pi_c[1], proof[7]);
      }
    });
    it("should have same tx hash", async () => {
      for (let txIndex = 0; txIndex < body.txs.length; txIndex += 1) {
        const txHash = await dt.getTxHash(txIndex, sampleFirstBlock);
        compare(body.txs[txIndex].hash().toString(), txHash);
      }
    });
  });
  describe("body massDeposits", () => {
    it("should have correct mass deposit array length", async () => {
      const len = await dt.getMassDepositsLen(sampleFirstBlock);
      compare(len, body.massDeposits.length);
    });
    it("should have correct mass deposit data", async () => {
      for (let index = 0; index < body.massDeposits.length; index += 1) {
        const { merged, fee } = await dt.getMassDeposit(
          index,
          sampleFirstBlock
        );
        compare(merged, body.massDeposits[index].merged);
        compare(fee, body.massDeposits[index].fee);
      }
    });
  });
  describe("body massMigrations", () => {
    it("should have correct mass migration array length", async () => {
      const len = await dt.getMassMigrationsLen(sampleFirstBlock);
      compare(len, body.massMigrations.length);
    });
    it("should have correct mass migration data", async () => {
      for (let index = 0; index < body.massMigrations.length; index += 1) {
        const {
          destination,
          eth,
          token,
          amount,
          merged,
          fee
        } = await dt.getMassMigration(index, sampleFirstBlock);
        compare(destination, body.massMigrations[index].destination);
        compare(eth, body.massMigrations[index].asset.eth);
        compare(token, body.massMigrations[index].asset.token);
        compare(amount, body.massMigrations[index].asset.amount);
        compare(merged, body.massMigrations[index].depositForDest.merged);
        compare(fee, body.massMigrations[index].depositForDest.fee);
      }
    });
  });
});
