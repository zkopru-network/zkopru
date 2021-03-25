/* eslint-disable no-unused-expressions */
/* eslint-disable jest/prefer-todo */
/* eslint-disable jest/require-top-level-describe */
/* eslint-disable jest/consistent-test-it */
const chai = require("chai");
const { UtxoTree, poseidonHasher } = require("~tree");
const { append, appendAsSubTrees } = require("~tree/utils/merkle-tree-sol");
const { Fp } = require("~babyjubjub");

const { expect } = chai;

const UtxoTreeTester = artifacts.require("UtxoTreeTester");

const compare = (a, b) => {
  expect(Fp.from(a.toString()).toHex()).equal(Fp.from(b.toString()).toHex());
};

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
    const result = await tree.dryAppend(...fixedSizeUtxos);
    return result;
  }
  throw Error("utxo tree flushes.");
};

contract("Utxo tree update tests", async accounts => {
  let mockup;
  let header;
  let body;
  let rawData;
  let solTree;
  let tsTree;
  let db;
  const depth = 48;
  before(async () => {
    const { tree, db } = await UtxoTree.sample(depth);
    tsTree = tree;
    mockup = db;
    solTree = await UtxoTreeTester.new();
  });
  after(async () => {
    await mockup.close();
  });
  describe("append", () => {
    it("should show same result", async () => {
      // const { root, index, siblings } = tsTree.data
      // const prevIndex = tsTree.latestLeafIndex()
      const leaves = [Fp.from("1"), Fp.from("2")];
      const prevTree = tsTree.getStartingLeafProof();
      const utxoTreeResult = await tsTree.dryAppend(...leaves.map(toLeaf));
      // console.log(utxoTreeResult)
      // console.log(siblings)
      const solidityAppendResult = await solTree.append(
        prevTree.root.toString(),
        prevTree.index.toString(),
        leaves.map(f => f.toString()),
        prevTree.siblings.map(sib => sib.toString())
      );
      compare(solidityAppendResult, utxoTreeResult.root);
    });
  });
  describe("appendSubTree", () => {
    it("should show same result", async () => {
      const { root, index, siblings } = tsTree.data;
      const prevIndex = tsTree.latestLeafIndex();
      const leaves = [Fp.from("1"), Fp.from("2")];
      const subTreeDepth = 5;
      const subTreeSize = 1 << subTreeDepth;
      const utxoTreeResult = await appendSubTree(
        tsTree,
        subTreeSize,
        leaves.map(toLeaf)
      );
      const solidityAppendAsSubTreesResult = await solTree.appendSubTree(
        root.toString(),
        index.toString(),
        subTreeDepth,
        leaves.map(f => f.toString()),
        siblings.slice(subTreeDepth).map(sib => sib.toString())
      );
      const solidityAppendResult = await solTree.append(
        root.toString(),
        index.toString(),
        leaves.map(f => f.toString()),
        siblings.map(sib => sib.toString())
      );
      const tsAppendAsSubTreeResult = appendAsSubTrees(
        poseidonHasher(depth),
        root,
        index,
        subTreeDepth,
        leaves,
        siblings.slice(subTreeDepth)
      );
      compare(solidityAppendAsSubTreesResult, utxoTreeResult.root);
      compare(solidityAppendResult, utxoTreeResult.root);
      compare(tsAppendAsSubTreeResult, utxoTreeResult.root);
    });
  });
});
