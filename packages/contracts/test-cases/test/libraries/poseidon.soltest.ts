import { BigNumber } from "ethers";
import { PoseidonTester } from "../../typechain";
import { Context, ZkopruTestFixture } from "../fixtures";
import { compare } from "../../helper";

const circomlib = require("circomlib");

const jsPoseidon = circomlib.poseidon;
const preHashedZeroAt = (i: number): bigint => {
  if (i === 0) return BigInt(0);
  const prev = preHashedZeroAt(i - 1);
  return jsPoseidon([prev, prev]);
};

describe("poseidon test", () => {
  let preHashed: BigNumber[];
  let fixtures: ZkopruTestFixture;
  let poseidonTester: PoseidonTester;
  const context = new Context();
  before(async () => {
    fixtures = await context.getFixtures();
    poseidonTester = fixtures.poseidonTester;
    preHashed = await poseidonTester.preHashed();
  });
  describe("preHashed", () => {
    Array(49)
      .fill(0)
      .forEach((_, i) => {
        it(`should equal to the hardcoded value in the smart contract: ${i}: ${preHashedZeroAt(
          i
        )}`, async () => {
          compare(preHashed[i], preHashedZeroAt(i));
        });
      });
  });
  describe("poseidon2", () => {
    it("should show same result (1)", async () => {
      const hash = await poseidonTester.poseidon2([1, 2]);
      compare(hash, jsPoseidon([1, 2]));
    });
    it("should show same result (2)", async () => {
      const hash = await poseidonTester.poseidon3([1, 2, 3]);
      compare(hash, jsPoseidon([1, 2, 3]));
    });
    it("should show same result (3)", async () => {
      const hash = await poseidonTester.poseidon4([1, 2, 3, 4]);
      compare(hash, jsPoseidon([1, 2, 3, 4]));
    });
  });
});
