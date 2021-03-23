/* eslint-disable no-unused-expressions */
/* eslint-disable jest/prefer-todo */
/* eslint-disable jest/require-top-level-describe */
/* eslint-disable jest/consistent-test-it */
const chai = require("chai");
const { Block } = require("~core");
const { Fp } = require("~babyjubjub");

const rawData =
  "0x90f8bf6a479f320ead074411a4b0e7944ea8c9c13eb336a96171bd4fd59c37933881374d5c70d801481e700140f917af4feb4ab0000000000000000000000000000000000000000000000000022e219e1e36c000231b1f0a2d938137a89b65b84e2a13447b23ad39c8cee9bd66f85a137eb7846700000000000000000000000000000000000000000000000000000000000000401304ce48ff9734d243a4c8b5c3a776d2e9f4f750033528ed069d8705927b2468f9295a686647cb999090819cda700820c282c613cedcd218540bbc6f37b01c65000000000000000000000000000000000000000000000000000000000000000017a541298fc8045a3c1961e70177fd392bacce3108ac56d6a3778d36569bd08e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003022d443779be20d1c4b268f62e6420a0f1107cb0aeada9f4f3e6242870bbd5e778036385aaa27fc0b1a0620a4d9a894edc45ff3a54406aa0b27f4a4e58b9cd39672d443779be20d1c4b268f62e6420a0f1107cb0aeada9f4f3e6242870bbd5e77822f255211ec8e9005aabbb783735634fda317fc5a6f47f851848a4770a4d688e0329482e0a5621d810a410f30d916fe60428baea6924ae6af2dfe29128724a96bd000dd80661562887c22d5bcde262b2e9717fd452f332f893c2642f2641accc0e22002fd840e00e9c2261af9e6bee517bcf6795c9d6f04a838c8ddf69baae6c3db4780000000000000000000000000000000000000000000000000000c970597ec3c00029804dea7bfefb6409e2262b3cf55a21e7cc118d0bfb6a5e129ae820d6501ce3160c9c039e361ffe7d092eabb85f4a648644793fec8340749dd63aae3502c3361c99868905575d27d0b613c0767417e889d04148ed6329eb470aec51545d8b683004557f3f2d02105b6228141d50cc66a541aba245a8976f691adab45f62d761106e70fb19bbc2da9412f4758c574ec0e7cda791437ede35ea8acdd4e4a39128067e9555a3a8ee95f5b07335e302145976a2673ecb5e02be0092ac49e29204b221cec0d98424af63803b7327ad28406baef0707f0e5e862430648051cbaabfd221ad36ce6d4dbc5a856976386496b94209f0fdc0cc000b086a7027aa19709c8402eb6136f53315db3d6c36fb97e8cbc2455ca8746efc6c191db49557eec393ed90e6e17e7452a086455eb5f6ee8b22e7fb8497319e44742a6d88cf458d6359bce19d85b0d068f346e3abfe2ba76656a9b556022d443779be20d1c4b268f62e6420a0f1107cb0aeada9f4f3e6242870bbd5e7781dbfa04b18f49600647a9d64aedeca505f6c479ecc0fc8f905f77dda067427e32d443779be20d1c4b268f62e6420a0f1107cb0aeada9f4f3e6242870bbd5e7780c08b8006342c42b1284be8a8550eba58ed45e75a05ede9d76b5abb3f2038ebe02107748d57643446a17fc75b708328c14af22b13abf654a7113d18fadb3f0f53b000f44c73531bb7798312d16d9fcd84bc78d3d5e000041e065c55fed24ced76b820000000000000000000000000000000000000000000000000000bdb7045f01800024b987929582a7128fd3b9c7b165d9c3237b6d37c384d7a94e66c3e624897e6f16c50ec3f5285ce0b5a21c757f15ff0049e1525f85bf1ecdf94d8d5c818693cb1f8f434b338db5b55c73c809823d4bf441962b0cde2d5a870c06d3d559ef0fbc0914e8a1119dcf609bea4d404c251358ae2947ce70d8aa7a10a9c761c7ab71e41f2bbd7343688403d72db6f1078586f6f3af4d41bd893c1e0fb57c8f4a40f752061991da57c52383a0b63052912a6d04b4ac30e3b3bc23751607cdfb87d6e7842b83589aa19bd04749efa192df50d0d56e8ab725deb1a7855bf42b97b60fd6c3026183dd3cab1ffe6c35d5f1cd9a29b0435cb7573eb47dc6cd1974e9a19a9b1202d7bdc41cd82f9be6df691558764d6bc245307cbb17a4e9dbdffac3453297d72bd4ebb77ce0673c8f2666369d09f353189703695597af52c53558cbacfe636fdae1c6643f4b9794cd523a3a03bcd082130c012d443779be20d1c4b268f62e6420a0f1107cb0aeada9f4f3e6242870bbd5e778121cb51183028d62568e6094d8f2bfec9b42f6cad1fac5f0618331690c0ccffb020566dc72aca0fc653aef08038e424946e39ab6885b404c1dfc61b1755e251c5c001f63e7b5a985784ff7c5ab930115c248cd745c0b13685f6b839bb3c2d171e36b0000000000000000000000000000000000000000000000000000a6fa4040718000074895461c4ca6ae3a5a5c8c0651f3d632862bb5956427cfd14a3022a3dc913910ed243037f01c0b4950b6565a7544b240ed42d36454807079e3d372e8c1b346270447eaab2a039f564aac2f050490c90f135670261c0794c45db52d4dfaf13a2213ff7796565c88e90d275a24e4ea330c4d599e0430c2f120544c18d7c185de17283a5a19a92ab8c6e78b47699c2584fc412bb9f3ac4ac124b9a353f9961024202ca45737fbc4a973454854de2b3b28a8a576f5a1ae564af393d5daadda32a8285161fe4b8f75ea1e6a9f78a5bd8b18de5b0861b2ee2d8c8a9a97cc8b01fc7e227b21d2302b6111ba588c0cb81e51087ce6c35336839c8daa0ddf2c5964172d02462a1d919d064cc687b64482e7a3171d405b462e01b57d605dd74b6cef41529893c154e608af47b9508743ce9c2295ea1e2b54b70a8e2bceac29af14ff2ed4d52ced9625ebba19f97f4ebb1246498146790000";

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
          totalETH,
          merged,
          fee
        } = await dt.getMassMigration(index, rawData);
        compare(destination, body.massMigrations[index].destination);
        compare(totalETH, body.massMigrations[index].totalETH);
        compare(merged, body.massMigrations[index].migratingLeaves.merged);
        compare(fee, body.massMigrations[index].migratingLeaves.fee);
      }
    });
    it("should have correct erc20 mass migration data", async () => {
      for (let index = 0; index < body.massMigrations.length; index += 1) {
        const { erc20 } = body.massMigrations[index];
        for (let j = 0; j < erc20.length; j += 1) {
          const { token, amount } = await dt.getERC20Migration(
            index,
            j,
            rawData
          );
          compare(token, erc20[j].addr);
          compare(amount, erc20[j].amount);
        }
      }
    });
    it("should have correct erc721 mass migration data", async () => {
      for (let index = 0; index < body.massMigrations.length; index += 1) {
        const { erc721 } = body.massMigrations[index];
        for (let j = 0; j < erc721.length; j += 1) {
          const { token, nfts } = await dt.getERC721Migration(
            index,
            j,
            rawData
          );
          compare(token, erc721[j].addr);
          compare(nfts.length, erc721[j].nfts.length);
          for (let k = 0; k < erc721[j].nfts.length; k += 1) {
            compare(nfts[k], erc721[j].nfts[k]);
          }
        }
      }
    });
  });
});
