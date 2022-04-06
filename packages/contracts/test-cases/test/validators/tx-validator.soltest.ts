import { Block } from "~core/block";
import path from "path";
import fs from "fs";
import { expect } from "chai";
import { compare, sampleBlock } from "../../helper";
import { TxValidatorTester } from "../../typechain";
import { Context, ZkopruTestFixture } from "../fixtures";

function loadVkJsonFiles() {
  const vks: any[4][4] = Array(4)
    .fill(undefined)
    .map(n => Array(4).fill(undefined));
  const nIn = [1, 2, 3, 4];
  const nOut = [1, 2, 3, 4];
  nIn.forEach(i => {
    nOut.forEach(j => {
      const vkPath = path.join(
        __dirname,
        `../../../keys/vks/zk_transaction_${i}_${j}.vk.json`
      );
      const vk = JSON.parse(fs.readFileSync(vkPath).toString());
      vks[i - 1][j - 1] = vk;
    });
  });
  return vks;
}

const block = Block.from(sampleBlock);

describe("txValidator test", () => {
  let txValidatorTester: TxValidatorTester;
  let vks: any[4][4];
  let fixtures: ZkopruTestFixture;
  const context = new Context();
  before(async () => {
    fixtures = await context.getFixtures();
    txValidatorTester = fixtures.txValidatorTester;
    vks = loadVkJsonFiles();
    for (let i = 1; i <= 4; i += 1) {
      for (let j = 1; j <= 4; j += 1) {
        const vk = vks[i - 1][j - 1];
        // caution: snarkjs G2Point is reversed
        await txValidatorTester.registerVk(i, j, {
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
          ic: vk.IC.map((ic: any[]) => ({
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
      const result = await txValidatorTester.getProof(sampleBlock, 0);
      compare(result.a.X, proof?.pi_a[0]);
      compare(result.a.Y, proof?.pi_a[1]);
      compare(result.b.X[0], proof?.pi_b[0][1]);
      compare(result.b.X[1], proof?.pi_b[0][0]);
      compare(result.b.Y[0], proof?.pi_b[1][1]);
      compare(result.b.Y[1], proof?.pi_b[1][0]);
      compare(result.c.X, proof?.pi_c[0]);
      compare(result.c.Y, proof?.pi_c[1]);
    });
    it("sample snark test", async () => {
      const result = await txValidatorTester.verifierTest();
      expect(result).to.be.true;
    });
    it("tx snark test", async () => {
      const result1 = await txValidatorTester.validateSNARK(sampleBlock, 0);
      expect(result1.slash).to.be.false;
      const result2 = await txValidatorTester.validateSNARK(sampleBlock, 1);
      expect(result2.slash).to.be.false;
      const result3 = await txValidatorTester.validateSNARK(sampleBlock, 2);
      expect(result3.slash).to.be.false;
    });
  });
});
