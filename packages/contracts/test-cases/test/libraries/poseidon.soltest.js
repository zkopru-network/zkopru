/* eslint-disable jest/valid-expect */
/* eslint-disable no-unused-expressions */
/* eslint-disable jest/prefer-todo */
/* eslint-disable jest/require-top-level-describe */
/* eslint-disable jest/consistent-test-it */
const chai = require("chai");
const circomlib = require("circomlib");
const { Fp } = require("~babyjubjub");

const { expect } = chai;
const { toBN } = web3.utils;
const jsPoseidon = circomlib.poseidon;

const PoseidonTester = artifacts.require("PoseidonTester");

const preHashedZeroAt = i => {
  if (i === 0) return 0;
  const prev = preHashedZeroAt(i - 1);
  return jsPoseidon([prev, prev]);
};

contract.only("Poseidon", async accounts => {
  let poseidon;
  let preHashed;
  let poseidonTester;
  before(async () => {
    poseidonTester = await PoseidonTester.deployed();
    preHashed = await poseidonTester.preHashed();
  });
  describe("preHashed", () => {
    Array(49)
      .fill(0)
      .forEach((_, i) => {
        it(`should equal to the hardcoded value in the smart contract: ${i}: ${preHashedZeroAt(
          i
        )}`, async () => {
          expect(preHashed[i].toString(10)).to.equal(
            preHashedZeroAt(i).toString()
          );
        });
      });
  });
  describe("poseidon2", () => {
    it("should show same result (1)", async () => {
      const hash = await poseidonTester.poseidon2([1, 2]);
      expect(hash.toString()).to.equal(jsPoseidon([1n, 2n]).toString());
    });
    it("should show same result (2)", async () => {
      const hash = await poseidonTester.poseidon3([1, 2, 3]);
      expect(hash.toString()).to.equal(jsPoseidon([1n, 2n, 3n]).toString());
    });
    it("should show same result (3)", async () => {
      const hash = await poseidonTester.poseidon4([1, 2, 3, 4]);
      expect(hash.toString()).to.equal(jsPoseidon([1n, 2n, 3n, 4n]).toString());
    });
  });
});
