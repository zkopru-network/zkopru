/* eslint-disable jest/valid-expect */
/* eslint-disable no-unused-expressions */
/* eslint-disable jest/prefer-todo */
/* eslint-disable jest/require-top-level-describe */
/* eslint-disable jest/consistent-test-it */

const chai = require("chai");
const { reverse } = require("dns");
const fs = require("fs");
const path = require("path");
const { Bytes32, Uint256 } = require("soltypes");
const { Block } = require("~core/block");
const { compare, sampleBlock } = require("../../helper");

const { expect } = chai;

const HeaderValidatorTester = artifacts.require("HeaderValidatorTester");

contract("HeaderValidator test", async accounts => {
  let headerValidator;
  let vks;
  before(async () => {
    headerValidator = await HeaderValidatorTester.new();
  });
  describe("valid cases", () => {
    it("deposit root test", async () => {
      const result = await headerValidator.validateDepositRoot(sampleBlock);
      expect(result.slash).to.be.false;
    });
    it("tx root test", async () => {
      const result = await headerValidator.validateTxRoot(sampleBlock);
      expect(result.slash).to.be.false;
    });
    it("migration root test", async () => {
      const result = await headerValidator.validateMigrationRoot(sampleBlock);
      expect(result.slash).to.be.false;
    });
    it("total fee test", async () => {
      const result = await headerValidator.validateTotalFee(sampleBlock);
      expect(result.slash).to.be.false;
    });
  });
  describe("challenge cases", () => {
    it("deposit root test", async () => {
      const block = Block.from(sampleBlock);
      block.header.depositRoot = Bytes32.from(
        "0xabababababababababababababababababababababababababababababababab"
      );
      const result = await headerValidator.validateDepositRoot(
        block.serializeBlock()
      );
      expect(result.slash).to.be.true;
    });
    it("tx root test", async () => {
      const block = Block.from(sampleBlock);
      block.header.txRoot = Bytes32.from(
        "0xabababababababababababababababababababababababababababababababab"
      );
      const result = await headerValidator.validateTxRoot(
        block.serializeBlock()
      );
      expect(result.slash).to.be.true;
    });
    it("migration root test", async () => {
      const block = Block.from(sampleBlock);
      block.header.migrationRoot = Bytes32.from(
        "0xabababababababababababababababababababababababababababababababab"
      );
      const result = await headerValidator.validateMigrationRoot(
        block.serializeBlock()
      );
      expect(result.slash).to.be.true;
    });
    it("total fee test", async () => {
      const block = Block.from(sampleBlock);
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
