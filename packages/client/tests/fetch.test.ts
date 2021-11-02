/* eslint-disable jest/no-hooks */
import assert from 'assert'
import Zkopru from '../src'

describe('mocked fetch', () => {
  beforeAll(() => {
    // eslint-disable-next-line jest/prefer-spy-on
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ result: 'mocked' }),
      } as any),
    )
  })

  it('should use mocked fetch implementation', async () => {
    const rpc = new Zkopru.RPC('http://localhost')
    assert.equal(await rpc.getAddress(), 'mocked')
  })
})
