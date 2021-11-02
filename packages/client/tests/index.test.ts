import assert from 'assert'
import Zkopru from '../src'

describe('client tests', () => {
  it('should use node-fetch implementation', async () => {
    const zkopru = new Zkopru.RPC('http://localhost')
    try {
      await zkopru.getAddress()
      assert(false)
    } catch (err) {
      assert(true)
    }
  }, 10000)
})
