import Web3 from 'web3'

describe('index', () => {
  it('run', () => {
    const web3 = new Web3('http://localhost:8545')
    expect(web3).toBeDefined()
  })
})
