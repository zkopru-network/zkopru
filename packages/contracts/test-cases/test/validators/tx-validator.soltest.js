/* eslint-disable jest/valid-expect */
/* eslint-disable no-unused-expressions */
/* eslint-disable jest/prefer-todo */
/* eslint-disable jest/require-top-level-describe */
/* eslint-disable jest/consistent-test-it */

const chai = require("chai");
const { reverse } = require("dns");
const fs = require("fs");
const path = require("path");
const { Block } = require("~core/block");
const { compare, sampleBlock } = require("../../helper");

const { expect } = chai;

const TxValidatorTester = artifacts.require("TxValidatorTester");

function loadVkJsonFiles() {
  const vks = {
    1: {},
    2: {},
    3: {},
    4: {}
  };
  const nIn = [1, 2, 3, 4];
  const nOut = [1, 2, 3, 4];
  nIn.forEach(i => {
    nOut.forEach(j => {
      const vkPath = path.join(
        __dirname,
        `../../../keys/vks/zk_transaction_${i}_${j}.vk.json`
      );
      const vk = JSON.parse(fs.readFileSync(vkPath));
      vks[i][j] = vk;
    });
  });
  return vks;
}

const block = Block.from(sampleBlock);

contract("TxValidator test", async accounts => {
  let snarkTester;
  let vks;
  before(async () => {
    snarkTester = await TxValidatorTester.new();
    vks = loadVkJsonFiles();
    for (let i = 1; i <= 4; i += 1) {
      for (let j = 1; j <= 4; j += 1) {
        const vk = vks[i][j];
        // caution: snarkjs G2Point is reversed
        const receipt = await snarkTester.registerVk(i, j, {
          alpha1: { X: vk.vk_alpha_1[0], Y: vk.vk_alpha_1[1] },
          beta2: {
            X: vk.vk_beta_2[0].reverse(),
            Y: vk.vk_beta_2[1].reverse()
          },
          gamma2: {
            X: vk.vk_gamma_2[0].reverse(),
            Y: vk.vk_gamma_2[1].reverse()
          },
          delta2: {
            X: vk.vk_delta_2[0].reverse(),
            Y: vk.vk_delta_2[1].reverse()
          },
          ic: vk.IC.map(ic => ({
            X: ic[0],
            Y: ic[1]
          }))
        });
      }
    }
  });
  describe("snark test", () => {
    it("serialization", async () => {
      const { proof } = block.body.txs[0];
      const result = await snarkTester.getProof(sampleBlock, 0);
      compare(result.a.X, proof.pi_a[0]);
      compare(result.a.Y, proof.pi_a[1]);
      compare(result.b.X[0], proof.pi_b[0][1]);
      compare(result.b.X[1], proof.pi_b[0][0]);
      compare(result.b.Y[0], proof.pi_b[1][1]);
      compare(result.b.Y[1], proof.pi_b[1][0]);
      compare(result.c.X, proof.pi_c[0]);
      compare(result.c.Y, proof.pi_c[1]);
    });
    it("sample snark test", async () => {
      const result = await snarkTester.verifierTest();
      expect(result).to.be.true;
    });
    it("tx snark test", async () => {
      const result1 = await snarkTester.validateSNARK(sampleBlock, 0);
      expect(result1.slash).to.be.false;
      const result2 = await snarkTester.validateSNARK(sampleBlock, 1);
      expect(result2.slash).to.be.false;
      const result3 = await snarkTester.validateSNARK(sampleBlock, 2);
      expect(result3.slash).to.be.false;
    });
  });
});
