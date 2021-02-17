import assert from 'assert'
import Zkopru from '../src'

beforeAll(() => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ result: 'mocked' }),
  }) as any)
})

test('should use mocked fetch implementation', async () => {
  const zkopru = new Zkopru('http://localhost')
  assert.equal(await zkopru.rpc.getAddress(), 'mocked')
})
