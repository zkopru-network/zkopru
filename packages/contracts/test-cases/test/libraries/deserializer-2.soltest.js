/* eslint-disable no-unused-expressions */
/* eslint-disable jest/prefer-todo */
/* eslint-disable jest/require-top-level-describe */
/* eslint-disable jest/consistent-test-it */
const chai = require("chai");
const { Block } = require("~core");
const { Fp } = require("~babyjubjub");

const rawData =
  "0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1c8e6239057ec533209a70de338b4580d3ee4c8df4731079f0e2d9169b4cbc65b000000000000000000000000000000000000000000000000022e219e1e36c00029197468f15152e97fdb6b04b6b62cc6632cd0fde044a4d96cd4cc850202785b000000000000000000000000000000000000000000000000000000000000004028264b35fa255896382dae8eec0e1da0f45ae9fe97baf7cde602fefdd78c8448f9295a686647cb999090819cda700820c282c613cedcd218540bbc6f37b01c65000000000000000000000000000000000000000000000000000000000000000089ab0ae9bf80342672cfc7b1b366e43010aff6cffd8f9c08572a56ba81fc1d7e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000302012cf748e54bb31e53ebddf9896ef8ba1dc80404ec6505ddb48cc1714fd3851a2bb64b6e3eb9737c2dd8ddeb16d3db953e611404b112adb97f3bf694ad09fd9a012cf748e54bb31e53ebddf9896ef8ba1dc80404ec6505ddb48cc1714fd3851a03b92c544a81ee2df689b3e2f41c1ec6dd07f094cd1ad6bf608749afe6cbd694030bac024335d03f624d861d61cfcc957bec3492f9ef0d2bfb34b67b30042b949a002cc3048c408bca35e266206d0c4cb27d0fbd470b9586ea1358b403d2dde394d00023a9e9b86d1f02010b37cceba9245876d4e4491cce07406d54c01662e802048c0000000000000000000000000000000000000000000000000000c970597ec3c00027f654137e42711db90e02040f56c160cfc8b569455b87f59d4ddf530127615a073d9cbc09414e51a619ad8b3c2ba2c52a5e40c4425eddaed89c488a9f09daa6011f6ad7e3dcc4a1aacfb66a78fa8df96a7e144779f9b59dbec630c7388c9f6b0cd408d481d71a4b70b525227b60d44a21423b3612ce9924305d381ad359cc9d05300bbc9ffb8a33aa8f0079d4e3c7b2962a2a53f350bf7b73a1b12bc4470ff90324e954511ea68245d70c06335b8eff0d63d396139054b256b7c35b200081c523ace2b0826f6110ba46081c41b16af0f7f7f1ea7d2dfbbf80b0e6c59ecbd00b038ee8916fc729093c2c2e30276effc8093e2d66eec32dd112b076408c80361d02053be3971f4efb818b419cd19084579fab8c63ea4374d1a3c0977489d03661a20f439e735d39d5b5ec1b82cec246616f91663fad87038d0fb648cfd9c3e20a3abf74db57134e32f0771a4d9f9152050ba402012cf748e54bb31e53ebddf9896ef8ba1dc80404ec6505ddb48cc1714fd3851a105e05c8069afbf02cac152968718f70a5734ef4b4b36bb10c8a3040cebac4e7012cf748e54bb31e53ebddf9896ef8ba1dc80404ec6505ddb48cc1714fd3851a1773bb516bb784a4c7ebeb9e532c9cd2eca712b7897ed32bb299893630e41b91021925176b6c1002e2a42d5525e13eb3a72c3c41637787f769fceac902acc0411800275eddcfaeb1a818450d2cd257e3d2cfee543b8d9b4e78b9de7307d595baf6a70000000000000000000000000000000000000000000000000000bdb7045f0180001bbb3d1d5a15264718bb95f6f41fecaa680f76785c27922d71057e14420a14472b6078ee6b279f03f2746507de6612e88515d2b547980eb448ccc64fa138dbac2227b907fd281d91cec5b289303074975105754718502b5f5272458c2328b5d2109a4abd73f2f57443ca13c76daa1d3444630374a5849791fa562201af805ee824e968252881372712ade67e88f05c11c88412c1de916a9a052b5a03aba251cc2849e3c90e5455bb88c54994b8f03440e65174f354b2f9f5260340ab7f2f42bf11f4624a6682e912a8747eae7a45efcea1b8116acf3215d820824facfb294d7e0847e18c6187bb798873db6c6c6e1b6c5b75ca9cd68762f9a03dac70ec691b7002501fec5244f278b392cb2a2875c3111b7485c2ec49c28a824d1629b1c82456a62ed94a51e08c3807f6a6a6f8ec440c25ad869bb797ffacd8dcbd7b5b7f79090b704a1208109a34cbfb509846ee3793d44a01012cf748e54bb31e53ebddf9896ef8ba1dc80404ec6505ddb48cc1714fd3851a1283abd279645dccefef3a8465fa1973f743e681527311ad027407647f1bd4ff022ba5b3ccc162c0bef60039806adc1f37dccda23b4977f288902c22af7fdf88e800000a9e6bf15f0aa81d876725c90af73bfde4fbf5cedf99b13714c973e74c86b40000000000000000000000000000000000000000000000000000a6fa404071800013a928b8681a4b75cb6cd6c2533791093f2d95467e02ed248e79afdb1374e4c80b24d716e25fe151a4d73be36067f81f897c6daf4e1e57f03d3c3b9d3bf878871513443c39bc86d4efbdeb3f4ff00a08068c76419444879c7990392e96066ed323b8791fdeca601708ee4417bd6f7e83ccc5c9ad2fd26f92df469b5ddf2415690d1193bbf054f6963e99d6a56457e11a8dbbd94e9b661b8e010ac84f68d1451311a94bad0aabccfc6b511807cf564f73f9b176f2615f41c5d7dd23272681a9b61e9912f359980d2629c81d2962d639c83f8fbd27da4340575fc712697c7774dc234428901559d59ec71d8ba5eb43dcc44049d6161f5731ac02373b0db9922f6002273beb2c7cf45468a411648af1bd33dd23b38b4e1754c70d72183e3d23e46e9138392cbd3f3adc2af6b6d32e2f2e6562b5dade0de09514b68efc2e877cf84ce6a01ea018089fe7a750302e05faf4f6becc0000";

const { expect } = chai;

const DeserializationTester = artifacts.require("DeserializationTester");

const compare = (a, b) => {
  expect(Fp.from(a.toString()).toHex()).equal(Fp.from(b.toString()).toHex());
};

contract("Block serialize-deserialize tests", async accounts => {
  let header;
  let body;
  let block;
  let dt;
  before(async () => {
    dt = await DeserializationTester.new(accounts[0]);
    block = Block.from(rawData);
    body = block.body;
    header = block.header;
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
        // caution: snarkjs G2Point is reversed
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
          eth,
          token,
          amount,
          merged,
          fee
        } = await dt.getMassMigration(index, rawData);
        compare(destination, body.massMigrations[index].destination);
        compare(eth, body.massMigrations[index].asset.eth);
        compare(token, body.massMigrations[index].asset.token);
        compare(amount, body.massMigrations[index].asset.amount);
        compare(merged, body.massMigrations[index].migratingLeaves.merged);
        compare(fee, body.massMigrations[index].migratingLeaves.fee);
      }
    });
  });
});
