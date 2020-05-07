/* eslint-disable jest/prefer-todo */
/* eslint-disable jest/require-top-level-describe */
/* eslint-disable jest/consistent-test-it */
const chai = require('chai')
const { dummyHeader, getDummyBody } = require('~dataset/testset-block')
const { serializeHeader, serializeBody } = require('~core')

const { expect } = chai

const DeserializationTester = artifacts.require('DeserializationTester')

contract('Simple tests', async accounts => {
  let header
  let body
  let rawData
  let dt
  before(async () => {
    dt = await DeserializationTester.new(accounts[0])
    header = dummyHeader
    body = await getDummyBody()
    rawData = Buffer.concat([serializeHeader(dummyHeader), serializeBody(body)])
  })
  describe('header test', () => {
    it('should have correct proposer', async () => {
      const proposer = await dt.getProposer(rawData)
      expect(header.proposer.toLowerCase()).equal(proposer.toLowerCase())
    })
    it('should have correct parent block', async () => {
      const parentBlock = await dt.getParentBlock(rawData)
      expect(header.parentBlock.toLowerCase()).equal(parentBlock)
    })
    it('should have correct utxo rollup', async () => {
      const { root, index } = await dt.getUTXORollUp(rawData)
      expect(header.utxoRoot.toLowerCase()).equal(
        `0x${web3.utils.leftPad(root, 64).toLowerCase()}`,
      )
      expect(header.utxoIndex.toLowerCase()).equal(
        `0x${web3.utils.leftPad(index, 64).toLowerCase()}`,
      )
    })
    it('should have correct nullifier rollup', async () => {
      const root = await dt.getNullifierRollUp(rawData)
      expect(header.nullifierRoot.toLowerCase()).equal(root.toLowerCase())
    })
    it('should have correct withdrawal rollup', async () => {
      const { root, index } = await dt.getWithdrawalRollUp(rawData)
      expect(header.withdrawalRoot.toLowerCase()).equal(root)
      expect(header.withdrawalIndex.toLowerCase()).equal(
        `0x${web3.utils.leftPad(index, 64).toLowerCase()}`,
      )
    })
    it('should have correct tx root', async () => {
      const txRoot = await dt.getTxRoot(rawData)
      expect(header.txRoot.toLowerCase()).equal(txRoot)
    })
    it('should have correct mass deposit root', async () => {
      const mdRoot = await dt.getMassDepositRoot(rawData)
      expect(header.depositRoot.toLowerCase()).equal(mdRoot)
    })
    it('should have correct mass migration root', async () => {
      const mmRoot = await dt.getMassMigrationRoot(rawData)
      expect(header.migrationRoot.toLowerCase()).equal(mmRoot)
    })
  })
  describe.skip('body test', () => {
    it('should have correct tx data', async () => {
    })
  })
})
