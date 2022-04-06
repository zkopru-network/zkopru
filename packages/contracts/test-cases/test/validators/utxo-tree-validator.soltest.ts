/* eslint-disable jest/valid-expect */
/* eslint-disable no-unused-expressions */
/* eslint-disable jest/prefer-todo */
/* eslint-disable jest/require-top-level-describe */
/* eslint-disable jest/consistent-test-it */

import { randomHex } from "web3-utils";
import { Fp } from "~babyjubjub/fp";
import { Block } from "~core/block";
import { UtxoTree } from "~tree";
import sample from "~tree/sample";
import { compare, sampleBlock } from "../../helper";
import { UtxoTreeValidatorTester } from "../../typechain";
import { Context, ZkopruTestFixture } from "../fixtures";

const block = Block.from(sampleBlock);
const toLeaf = (val: Fp) => ({
  hash: val
});

type TreeSnapshot = {
  root: Fp;
  index: Fp;
  siblings: Fp[];
};

describe("utxoTreeValidator test", () => {
  let utxoTreeValidatorTester: UtxoTreeValidatorTester;
  let tsTree: UtxoTree;
  const depth = 48;
  let fixtures: ZkopruTestFixture;
  const context = new Context();
  before(async () => {
    const { tree } = await sample(depth);
    tsTree = tree;
    fixtures = await context.getFixtures();
    utxoTreeValidatorTester = fixtures.utxoTreeValidatorTester;
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
              .filter(outflow => outflow.outflowType.eq(0))
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
    let startSnapshot: TreeSnapshot;
    let resultSnapshot: TreeSnapshot;
    let utxos: Fp[];
    before(async () => {
      const prevIndex = tsTree.latestLeafIndex();
      utxos = Array(Math.floor(subTreeSize * 33))
        .fill(undefined)
        .map((_, index) => Fp.from(index + 1));
      console.log("tstree index", prevIndex);
      startSnapshot = await tsTree.dryAppend([]);
      resultSnapshot = await tsTree.dryAppend(utxos.map(toLeaf));
    });
    describe("prepare a proof", () => {
      let proofId: string;
      before(() => {
        proofId = randomHex(32);
      });
      it("should create a proof", async () => {
        await utxoTreeValidatorTester.newProof(
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
