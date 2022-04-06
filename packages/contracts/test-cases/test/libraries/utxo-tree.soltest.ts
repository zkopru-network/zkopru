/* eslint-disable no-unused-expressions */
/* eslint-disable jest/prefer-todo */
/* eslint-disable jest/require-top-level-describe */
/* eslint-disable jest/consistent-test-it */
import { UtxoTree, poseidonHasher, Leaf } from "~tree";
import { DB } from "~database";
import { appendAsSubTrees } from "~tree/utils/merkle-tree-sol";
import sample from "~tree/sample";
import { Fp } from "~babyjubjub";
import { UtxoTreeTester } from "../../typechain";
import { Context, ZkopruTestFixture } from "../fixtures";
import { compare } from "../../helper";

const toLeaf = (val: Fp) => ({
  hash: val
});

const appendSubTree = async (
  tree: UtxoTree,
  subtreeSize: number,
  leaves: Leaf<Fp>[]
) => {
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

describe("utxo tree update tests", () => {
  let mockupDB: DB;
  let solTree: UtxoTreeTester;
  let tsTree: UtxoTree;
  const depth = 48;
  let fixtures: ZkopruTestFixture;
  const context = new Context();
  before(async () => {
    const { tree, db } = await sample(depth);
    tsTree = tree;
    mockupDB = db;
    fixtures = await context.getFixtures();
    solTree = fixtures.utxoTreeTester;
  });
  after(async () => {
    await mockupDB.close();
  });
  describe("append", () => {
    it("should show same result", async () => {
      // const { root, index, siblings } = tsTree.data
      // const prevIndex = tsTree.latestLeafIndex()
      const leaves = [Fp.from("1"), Fp.from("2")];
      const prevTree = await tsTree.getStartingLeafProof();
      const utxoTreeResult = await tsTree.dryAppend(leaves.map(toLeaf));
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
    it("should show same result for small subtree", async () => {
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

    it("should show same result for large subtree", async () => {
      const { root, index, siblings } = tsTree.data;
      const prevIndex = tsTree.latestLeafIndex();
      const subTreeDepth = 5;
      const subTreeSize = 1 << subTreeDepth;
      const leaves = Array(Math.floor(subTreeSize * 1.4))
        .fill(undefined)
        .map((_, index) => Fp.from(index + 1));
      const solidityAppendAsSubTreesResult = await solTree.appendSubTree(
        root.toString(),
        index.toString(),
        subTreeDepth,
        leaves.map(f => f.toString()),
        siblings.slice(subTreeDepth).map(sib => sib.toString())
      );
      const tsAppendAsSubTreeResult = appendAsSubTrees(
        poseidonHasher(depth),
        root,
        index,
        subTreeDepth,
        leaves,
        siblings.slice(subTreeDepth)
      );
      compare(solidityAppendAsSubTreesResult, tsAppendAsSubTreeResult);
    });
  });
});
