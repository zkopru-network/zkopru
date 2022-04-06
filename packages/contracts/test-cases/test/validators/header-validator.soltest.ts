import { Bytes32, Uint256 } from "soltypes";
import { Block } from "~core/block";
import { expect } from "chai";
import { sampleFirstBlock } from "../../helper";
import { HeaderValidator } from "../../typechain";
import { Context, ZkopruTestFixture } from "../fixtures";

describe("headerValidator test", () => {
  let fixtures: ZkopruTestFixture;
  let headerValidator: HeaderValidator;
  const context = new Context();
  before(async () => {
    fixtures = await context.getFixtures();
    headerValidator = fixtures.headerValidatorTester;
  });
  describe("valid cases", () => {
    it("deposit root test", async () => {
      const result = await headerValidator.validateDepositRoot(
        sampleFirstBlock
      );
      expect(result.slash).to.be.false;
    });
    it("tx root test", async () => {
      const result = await headerValidator.validateTxRoot(sampleFirstBlock);
      expect(result.slash).to.be.false;
    });
    it("migration root test", async () => {
      const result = await headerValidator.validateMigrationRoot(
        sampleFirstBlock
      );
      expect(result.slash).to.be.false;
    });
    it("total fee test", async () => {
      const result = await headerValidator.validateTotalFee(sampleFirstBlock);
      expect(result.slash).to.be.false;
    });
  });
  describe("challenge cases", () => {
    it("deposit root test", async () => {
      const block = Block.from(sampleFirstBlock);
      block.header.depositRoot = Bytes32.from(
        "0xabababababababababababababababababababababababababababababababab"
      );
      const result = await headerValidator.validateDepositRoot(
        block.serializeBlock()
      );
      expect(result.slash).to.be.true;
    });
    it("tx root test", async () => {
      const block = Block.from(sampleFirstBlock);
      block.header.txRoot = Bytes32.from(
        "0xabababababababababababababababababababababababababababababababab"
      );
      const result = await headerValidator.validateTxRoot(
        block.serializeBlock()
      );
      expect(result.slash).to.be.true;
    });
    it("migration root test", async () => {
      const block = Block.from(sampleFirstBlock);
      block.header.migrationRoot = Bytes32.from(
        "0xabababababababababababababababababababababababababababababababab"
      );
      const result = await headerValidator.validateMigrationRoot(
        block.serializeBlock()
      );
      expect(result.slash).to.be.true;
    });
    it("total fee test", async () => {
      const block = Block.from(sampleFirstBlock);
      block.header.fee = Uint256.from(
        "10000000000000000000000000000000000000000000000"
      );
      const result = await headerValidator.validateTotalFee(
        block.serializeBlock()
      );
      expect(result.slash).to.be.true;
    });
  });
});
