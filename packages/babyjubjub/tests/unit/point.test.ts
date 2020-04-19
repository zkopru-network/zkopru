/* eslint-disable jest/no-hooks */
import { Point, signEdDSA, verifyEdDSA } from '~babyjubjub'

describe('baby jubjub point', () => {
  it('should return generator', () => {
    expect(Point.GENERATOR).toBeDefined()
  })
  describe('generate()', () => {
    it('should generate babyjubjub points multiplying BASE8 point', () => {
      expect(Point.generate(1)).toBeDefined()
      expect(Point.generate(2)).toBeDefined()
    })
  })
  describe('toHex()', () => {
    it('should return hex value', () => {
      const hex = Point.generate(2).toHex()
      expect(typeof hex).toBe('string')
    })
  })
  describe('fromHex()', () => {
    it('should return a Point instance from 0x prefixed hex string', () => {
      const hex = Point.generate(2).toHex()
      const point = Point.fromHex(hex)
      expect(point).toBeDefined()
    })
  })
  describe('eddsa', () => {
    const password = 'password'
    const pubKey = Point.fromPrivKey(password)
    it('should return an EdDSA pub key point from a private key string', () => {
      expect(pubKey).toBeDefined()
    })
    it('should recover the signature using babyjubjub point', () => {
      const msg = Buffer.from('hello world')
      const signature = signEdDSA({
        msg,
        privKey: password,
      })
      expect(verifyEdDSA(msg, signature, pubKey)).toBe(true)
    })
  })
})
