/* eslint-disable jest/valid-expect */
/* eslint-disable no-unused-expressions */
/* eslint-disable jest/prefer-todo */
/* eslint-disable jest/require-top-level-describe */
/* eslint-disable jest/consistent-test-it */

const chai = require("chai");
const { reverse } = require("dns");
const fs = require("fs");
const path = require("path");
const { Fp } = require("~babyjubjub/fp");
const { Block } = require("~core/block");
const { ZkTx } = require("~transaction/zk-tx");
const { compare, sampleBlock } = require("../../helper");

const { expect } = chai;

const UtxoTreeValidatorTester = artifacts.require("UtxoTreeValidatorTester");

const block = Block.from(sampleBlock);

contract("UtxoTreeValidator test", async accounts => {
  let utxoTreeValidatorTester;
  before(async () => {
    utxoTreeValidatorTester = await UtxoTreeValidatorTester.new();
  });
  describe("utxo append list test", () => {
    it("getUTXO", async () => {
      const fakeBlock = new Block({
        hash: block.hash,
        verified: block.verified,
        header: block.header,
        body: {
          massDeposits: block.body.massDeposits,
          massMigrations: block.body.massMigrations,
          txs: Array(10)
            .fill(block.body.txs)
            .reduce((acc, val) => [...acc, ...val], [])
        }
      });
      //
      const deposits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      const onchainUtxoItems = await utxoTreeValidatorTester.getUTXosFromBlock(
        fakeBlock.serializeBlock(),
        deposits
      );
      // offchain utxo calculation
      const offchainUtxoItems = fakeBlock.body.txs.reduce(
        (arr, tx) => {
          return [
            ...arr,
            ...tx.outflow
              .filter(outflow => outflow.outflowType.eqn(0))
              .map(outflow => outflow.note)
          ];
        },
        deposits.map(deposit => Fp.from(deposit.toString()))
      );
      onchainUtxoItems.forEach((val, i) => {
        compare(val, offchainUtxoItems[i]);
      });
    });
  });
});
