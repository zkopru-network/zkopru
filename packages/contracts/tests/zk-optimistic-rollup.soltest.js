/* eslint-disable jest/prefer-todo */
/* eslint-disable jest/require-top-level-describe */
/* eslint-disable jest/consistent-test-it */
const Layer2 = artifacts.require('ZkOptimisticRollUp')

contract('Simple tests', async accounts => {
  before(async () => {
    const layer2 = await Layer2.new(accounts[0])
  })
  it('should pass 1 empty case', () => {})
})
