/* eslint-disable jest/no-hooks */
import { Fp, verifyEdDSA } from '@zkopru/babyjubjub'
import { ZkAccount } from '~account'
import { trimHexToLength } from '~utils'

describe('class ZkAccount', () => {
  it('should make eddsa signature and verify that', async () => {
    const alicePrivKey = trimHexToLength(
      Buffer.from("I am Alice's private key"),
      64,
    )
    const bobPrivKey = trimHexToLength(Buffer.from("I am Bob's private key"), 64)
    const alice = new ZkAccount(alicePrivKey)
    const bob = new ZkAccount(bobPrivKey)
    const msg = Fp.from('0xabcd12344321d')
    const aliceSig = alice.signEdDSA(msg)
    const bobSig = bob.signEdDSA(msg)
    expect(verifyEdDSA(msg, aliceSig, alice.getEdDSAPubKey())).toBe(true)
    expect(verifyEdDSA(msg, bobSig, bob.getEdDSAPubKey())).toBe(true)
  })
})
