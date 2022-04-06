/**
 * @jest-environment node
 */

import { TokenRegistry } from '~transaction'
import { getDummyBody } from '../src/testset-block'
import { accounts } from '../src/testset-predefined'
import { loadZkTxs } from '../src/testset-zktxs'

describe('index', () => {
  it('run', async () => {
    const body = await getDummyBody()
    expect(body).toBeDefined()
  }, 600000)
  describe('zktx', () => {
    it('encrypt-decrypt works', async () => {
      const zktxs = await loadZkTxs()
      const tx1 = zktxs[0]
      const tokenRegistry: TokenRegistry = new TokenRegistry()
      const note = accounts.bob.decrypt(tx1, tokenRegistry)
      expect(note[0]).toBeDefined()
      expect(note[0].owner.toString()).toBe(accounts.bob.zkAddress.toString())
    }, 60000)
  })
})
