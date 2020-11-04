/* eslint-disable jest/valid-expect */
/* eslint-disable no-unused-expressions */
/* eslint-disable jest/prefer-todo */
/* eslint-disable jest/require-top-level-describe */
/* eslint-disable jest/consistent-test-it */
const chai = require('chai')
const { Field } = require('~babyjubjub')

const { expect } = chai
const { toBN } = web3.utils

const Poseidon2 = artifacts.require('Poseidon2')

const compare = (a, b) => {
  expect(Field.from(a.toString()).toHex()).equal(
    Field.from(b.toString()).toHex(),
  )
}

contract('Poseidon', async accounts => {
  let poseidon
  before(async () => {
    poseidon = await Poseidon2.deployed()
  })
  describe('preHasehd', () => {
    it('should show same result', async () => {
      const hash = await poseidon.poseidon([0, 0])
      expect(
        hash.eq(
          toBN(
            '10600974484483636649191836183331859514454108476826376357941356292578099372400',
          ),
        ),
      ).to.be.true
      // compare(solidityAppendResult, utxoTreeResult.root)
    })
  })
})
