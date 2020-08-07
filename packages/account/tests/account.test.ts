/* eslint-disable jest/no-hooks */
import { Field, verifyEdDSA } from '@zkopru/babyjubjub'
import { hexify } from '~utils'
import { ZkAccount } from '~account'

describe('class ZkAccount', () => {
  it('should make eddsa signature and verify that', async () => {
    const alicePrivKey = hexify("I am Alice's private key")
    const bobPrivKey = hexify("I am Bob's private key")
    const alice = new ZkAccount(alicePrivKey)
    const bob = new ZkAccount(bobPrivKey)
    const msg = Field.from('0xabcd12344321d')
    const aliceSig = alice.signEdDSA(msg)
    const bobSig = bob.signEdDSA(msg)
    expect(verifyEdDSA(msg, aliceSig, alice.getEdDSAPoint())).toBe(true)
    expect(verifyEdDSA(msg, bobSig, bob.getEdDSAPoint())).toBe(true)
  })
})
