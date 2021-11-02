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
      const point = Point.generate(2)
      const pointToHex = point.toHex()
      const pointFromHex = Point.fromHex(pointToHex)
      const regeneratedHex = pointFromHex.toHex()
      expect(point).toBeDefined()
      expect(regeneratedHex).toBe(pointToHex)
    })
    Array(50)
      .fill(null)
      .forEach((_, i) =>
        it(`should return a Point instance from hex string (${i + 1}G)`, () => {
          const point = Point.generate(i + 1)
          const pointToHex = point.toHex()
          const pointFromHex = Point.fromHex(pointToHex)
          const regeneratedHex = pointFromHex.toHex()
          expect(point).toBeDefined()
          expect(regeneratedHex).toBe(pointToHex)
        }),
      )
  })
  describe('isOnJubjub()', () => {
    it('should return true for generated points', () => {
      const point = Point.generate(2)
      expect(Point.isOnJubjub(point.x, point.y)).toBe(true)
    })
    it('should return true for decoded points', () => {
      const secret =
        '0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1'
      const pubKey = Point.fromPrivKey(secret)
      expect(Point.isOnJubjub(pubKey.x, pubKey.y)).toBe(true)
    })
    it('should return true for points from pub key', () => {
      const secret =
        '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d'
      const pubKey = Point.fromPrivKey(secret)
      const pubKeyToHex = pubKey.toHex()
      const retrievedPoint = Point.fromHex(pubKeyToHex)
      expect(Point.isOnJubjub(retrievedPoint.x, retrievedPoint.y)).toBe(true)
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
    describe('fromPrivKey', () => {
      it('should be able to same public key using Point.getMultiplier()', () => {
        const multiplier = Point.getMultiplier(password)
        expect(Point.BASE8.mul(multiplier).toHex()).toBe(pubKey.toHex())
      })
    })
  })
})
