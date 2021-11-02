/* eslint-disable jest/valid-expect */
/* eslint-disable no-unused-expressions */
/* eslint-disable jest/prefer-todo */
/* eslint-disable jest/require-top-level-describe */
/* eslint-disable jest/consistent-test-it */

const chai = require("chai");
const { reverse } = require("dns");
const fs = require("fs");
const path = require("path");
const { randomHex } = require("web3-utils");
const { Fp } = require("~babyjubjub/fp");
const { Block } = require("~core/block");
const { ZkTx } = require("~transaction/zk-tx");
const { UtxoTree, poseidonHasher } = require("~tree");
const {
  append,
  appendAsSubTrees,
  splitToSubTrees
} = require("~tree/utils/merkle-tree-sol");
const sample = require("~tree/sample").default;
const { compare, sampleBlock } = require("../../helper");

const { expect } = chai;

const UtxoTreeValidatorTester = artifacts.require("UtxoTreeValidatorTester");
const Poseidon2 = artifacts.require("Poseidon2");
const block = Block.from(sampleBlock);
const toLeaf = val => ({
  hash: val
});

const appendSubTree = async (tree, subtreeSize, leaves) => {
  const totalItemLen = subtreeSize * Math.ceil(leaves.length / subtreeSize);

  const fixedSizeUtxos = Array(totalItemLen).fill({
    hash: Fp.zero
  });
  leaves.forEach((item, index) => {
    fixedSizeUtxos[index] = item;
  });
  if (
    tree
      .latestLeafIndex()
      .add(totalItemLen)
      .lte(tree.maxSize())
  ) {
    const result = await tree.dryAppend(fixedSizeUtxos);
    return result;
  }
  throw Error("utxo tree flushes.");
};
contract("UtxoTreeValidator test", async accounts => {
  let header;
  let body;
  let rawData;
  let utxoTreeValidatorTester;
  let tsTree;
  const validTreeUpdate = {};
  const invalidTreeUpdate = {};
  const depth = 48;
  before(async () => {
    const { tree } = await sample(depth);
    tsTree = tree;
    const deployedPoseidon = await Poseidon2.deployed();
    UtxoTreeValidatorTester.link("Poseidon2", deployedPoseidon.address);
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
  describe("invalid OPRU should be reverted by the challenge", () => {
    const subTreeDepth = 5;
    const subTreeSize = 1 << subTreeDepth;
    let startSnapshot;
    let resultSnapshot;
    let utxos;
    let parentBlock;
    let fakeBlock;
    let validBlock;
    let proofId;
    before(async () => {
      const { root, index, siblings } = tsTree.data;
      const prevIndex = tsTree.latestLeafIndex();
      utxos = Array(Math.floor(subTreeSize * 33))
        .fill()
        .map((_, index) => Fp.from(index + 1));
      console.log("tstree index", prevIndex);
      startSnapshot = await tsTree.dryAppend([]);
      resultSnapshot = await tsTree.dryAppend(utxos.map(toLeaf));
    });
    describe("prepare a proof", () => {
      let proofId;
      before(() => {
        proofId = randomHex(32);
      });
      it("should create a proof", async () => {
        const receipt = await utxoTreeValidatorTester.newProof(
          proofId,
          startSnapshot.root.toString(),
          startSnapshot.index.toString(),
          startSnapshot.siblings.slice(subTreeDepth).map(sib => sib.toString())
        );
      });
      it("should update the proof and store them.", async () => {
        let i = 0;
        while (i < utxos.length) {
          console.log(`appending ${i} ~ ${Math.min(i + 32, utxos.length)}`);
          await utxoTreeValidatorTester.updateProof(
            proofId,
            utxos.slice(i, Math.min(i + 32, utxos.length))
          );
          i += 32;
        }
      });
      it("should return a correct proof", async () => {
        const storedProof = await utxoTreeValidatorTester.getProof(proofId);
        compare(storedProof.startRoot, startSnapshot.root);
        compare(storedProof.startIndex, startSnapshot.index);
        compare(storedProof.resultRoot, resultSnapshot.root);
        compare(storedProof.resultIndex, resultSnapshot.index);
      });
    });
  });
});
