/**
 * @jest-environment node
 */

import { getDummyBody } from '../src/testset-block'
import { accounts } from '../src/testset-keys'
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
      const note = accounts.bob.decrypt(tx1)
      expect(note).toBeDefined()
      expect(note?.pubKey.toHex()).toBe(accounts.bob.pubKey.toHex())
    }, 600000)
  })
})
