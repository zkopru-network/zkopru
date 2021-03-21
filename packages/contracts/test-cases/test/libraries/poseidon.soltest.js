/* eslint-disable jest/valid-expect */
/* eslint-disable no-unused-expressions */
/* eslint-disable jest/prefer-todo */
/* eslint-disable jest/require-top-level-describe */
/* eslint-disable jest/consistent-test-it */
const chai = require('chai')
const { Fp } = require('~babyjubjub')
const circomlib = require('circomlib')

const { expect } = chai
const { toBN } = web3.utils
const jsPoseidon = circomlib.poseidon

const Poseidon2 = artifacts.require('Poseidon2')
const PoseidonPreHashTester = artifacts.require('PoseidonPreHashTester')

const preHashedZeroAt = i => {
  if (i === 0) return 0
  const prev = preHashedZeroAt(i - 1)
  return jsPoseidon([prev, prev])
}

contract.only('Poseidon', async accounts => {
  let poseidon
  let preHashed
  before(async () => {
    poseidon = await Poseidon2.deployed()
    poseidonPreHashTester = await PoseidonPreHashTester.deployed()
    preHashed = await poseidonPreHashTester.preHashed()
  })
  describe('preHasehd', () => {
    it('should show same result', async () => {
      const hash = await poseidon.poseidon([0, 0])
      expect(hash).to.equal(jsPoseidon([0n, 0n]).toString())
    })
    Array(49).fill(0).forEach((_, i) => {
      it(`should equal to the hardcoded value in the smart contract: ${i}: ${preHashedZeroAt(i)}`, async () => {
        expect(preHashed[i].toString(10)).to.equal(preHashedZeroAt(i).toString())
      })
    })
  })
})
