import assert from 'assert'
import Zkopru from '../src'

test('should use node-fetch implementation', async () => {
  const zkopru = new Zkopru('http://localhost')
  try {
    await zkopru.rpc.getAddress()
    assert(false)
  } catch (err) {
    assert(true)
  }
}, 10000)
