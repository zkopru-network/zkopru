/* eslint-disable no-unused-expressions */
/* eslint-disable jest/prefer-todo */
/* eslint-disable jest/require-top-level-describe */
/* eslint-disable jest/consistent-test-it */
const chai = require("chai");
const { getDummyBlock } = require("~dataset/testset-block");
const { serializeHeader, serializeBody } = require("~core");
const { Fp } = require("~babyjubjub");

const { expect } = chai;

const DeserializationTester = artifacts.require("DeserializationTester");

const compare = (a, b) => {
  expect(Fp.from(a.toString()).toHex()).equal(Fp.from(b.toString()).toHex());
};

contract("Block serialize-deserialize tests", async accounts => {
  let header;
  let body;
  let rawData;
  let dt;
  before(async () => {
    dt = await DeserializationTester.new(accounts[0]);
    const dummyBlock = await getDummyBlock();
    body = dummyBlock.body;
    header = dummyBlock.header;
    rawData = Buffer.concat([serializeHeader(header), serializeBody(body)]);
  });
  describe("header test", () => {
    it("should have correct proposer", async () => {
      const proposer = await dt.getProposer(rawData);
      compare(header.proposer, proposer);
    });
    it("should have correct proposer even it accepts extra parameters", async () => {
      const proposer = await dt.getProposer2(0, 0, rawData);
      compare(header.proposer, proposer);
    });
    it("should have correct parent block", async () => {
      const parentBlock = await dt.getParentBlock(rawData);
      compare(header.parentBlock, parentBlock);
    });
    it("should have correct parent block even it accepts extra parameters", async () => {
      const parentBlock = await dt.getParentBlock2(0, 0, 0, rawData);
      compare(header.parentBlock, parentBlock);
    });
    it("should have correct utxo rollup", async () => {
      const { root, index } = await dt.getUTXORollUp(rawData);
      compare(header.utxoRoot, root);
      compare(header.utxoIndex, index);
    });
    it("should have correct nullifier rollup", async () => {
      const root = await dt.getNullifierRollUp(rawData);
      compare(header.nullifierRoot, root);
    });
    it("should have correct withdrawal rollup", async () => {
      const { root, index } = await dt.getWithdrawalRollUp(rawData);
      compare(header.withdrawalRoot, root);
      compare(header.withdrawalIndex, index);
    });
    it("should have correct tx root", async () => {
      const txRoot = await dt.getTxRoot(rawData);
      const computedTxRoot = await dt.computeTxRoot(rawData);
      compare(header.txRoot, txRoot);
      compare(header.txRoot, computedTxRoot);
    });
    it("should have correct mass deposit root", async () => {
      const mdRoot = await dt.getMassDepositRoot(rawData);
      compare(header.depositRoot, mdRoot);
      const computedMdRoot = await dt.computeDepositRoot(rawData);
      compare(header.depositRoot, computedMdRoot);
    });
    it("should have correct mass migration root", async () => {
      const mmRoot = await dt.getMassMigrationRoot(rawData);
      compare(header.migrationRoot, mmRoot);
      const computedMMRoot = await dt.computeMigrationRoot(rawData);
      compare(header.migrationRoot, computedMMRoot);
    });
  });
  describe("body txs", () => {
    it("should have correct tx array length", async () => {
      const txsLen = await dt.getTxsLen(rawData);
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
          const txInflow = await dt.getTxInflow(txIndex, inflowIndex, rawData);
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
            rawData
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
        const txFee = await dt.getTxFee(txIndex, rawData);
        compare(body.txs[txIndex].fee, txFee);
      }
    });
    it("should have correct swap value", async () => {
      for (let txIndex = 0; txIndex < body.txs.length; txIndex += 1) {
        const txSwap = await dt.getTxSwap(txIndex, rawData);
        compare(body.txs[txIndex].swap || 0, txSwap);
      }
    });
    it("should have correct proof value", async () => {
      for (let txIndex = 0; txIndex < body.txs.length; txIndex += 1) {
        const proof = await dt.getProof(txIndex, rawData);
        compare(body.txs[txIndex].proof.pi_a[0], proof[0]);
        compare(body.txs[txIndex].proof.pi_a[1], proof[1]);
        compare(body.txs[txIndex].proof.pi_b[0][1], proof[2]);
        compare(body.txs[txIndex].proof.pi_b[0][0], proof[3]);
        compare(body.txs[txIndex].proof.pi_b[1][1], proof[4]);
        compare(body.txs[txIndex].proof.pi_b[1][0], proof[5]);
        compare(body.txs[txIndex].proof.pi_c[0], proof[6]);
        compare(body.txs[txIndex].proof.pi_c[1], proof[7]);
      }
    });
    it("should have same tx hash", async () => {
      for (let txIndex = 0; txIndex < body.txs.length; txIndex += 1) {
        const txHash = await dt.getTxHash(txIndex, rawData);
        compare(body.txs[txIndex].hash().toString(), txHash);
      }
    });
  });
  describe("body massDeposits", () => {
    it("should have correct mass deposit array length", async () => {
      const len = await dt.getMassDepositsLen(rawData);
      // eslint-disable-next-line no-unused-expressions
      compare(len, body.massDeposits.length);
    });
    it("should have correct mass deposit data", async () => {
      for (let index = 0; index < body.massDeposits.length; index += 1) {
        const { merged, fee } = await dt.getMassDeposit(index, rawData);
        compare(merged, body.massDeposits[index].merged);
        compare(fee, body.massDeposits[index].fee);
      }
    });
  });
  describe("body massMigrations", () => {
    it("should have correct mass migration array length", async () => {
      const len = await dt.getMassMigrationsLen(rawData);
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
        } = await dt.getMassMigration(index, rawData);
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
          const { token, amount } = await dt.getERC20Migration(
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
          const { token, nfts } = await dt.getERC721Migration(
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
