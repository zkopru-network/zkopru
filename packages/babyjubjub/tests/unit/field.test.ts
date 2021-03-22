/* eslint-disable jest/no-hooks */
import BN from 'bn.js'
import { Fp } from '~babyjubjub'

describe('finite field', () => {
  let constant: Fp
  beforeAll(() => {
    constant = new Fp(18)
  })
  it('should accept number for its constructor parameter', () => {
    const a = new Fp(18)
    const b = Fp.from(18)
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    expect(a).toBeInstanceOf(Fp)
    expect(b).toBeInstanceOf(Fp)
    expect(constant.eq(a)).toBe(true)
    expect(constant.eq(b)).toBe(true)
  })
  it('should accept string string for its constructor parameter', () => {
    const a = new Fp('18')
    const b = Fp.from('18')
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    expect(a).toBeInstanceOf(Fp)
    expect(b).toBeInstanceOf(Fp)
    expect(constant.eq(a)).toBe(true)
    expect(constant.eq(b)).toBe(true)
  })
  it('should accept hex string with 0x prefix for its constructor parameter', () => {
    const a = new Fp('0x12')
    const b = Fp.from('0x12')
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    expect(a).toBeInstanceOf(Fp)
    expect(b).toBeInstanceOf(Fp)
    expect(constant.eq(a)).toBe(true)
    expect(constant.eq(b)).toBe(true)
  })
  it('should return same hex', () => {
    const f = new Fp('0xabcd1234abcd1234')
    expect(f.toHex(8)).toStrictEqual('0xabcd1234abcd1234')
  })
  it('should return cyclic hex for a number beyond the field range', () => {
    const f = new Fp(
      '0xabcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234',
    )
    expect(f.toHex(32)).not.toStrictEqual(
      '0xabcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234',
    )
  })
  it('should accept Buffer obj for its constructor parameter', () => {
    const a = new Fp(Buffer.from('12', 'hex'))
    const b = Fp.from(Buffer.from('12', 'hex'))
    expect(new Fp(Buffer.from('12', 'hex'))).toBeDefined()
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    expect(a).toBeInstanceOf(Fp)
    expect(b).toBeInstanceOf(Fp)
    expect(constant.eq(a)).toBe(true)
    expect(constant.eq(b)).toBe(true)
  })
  it('should accept BN object for its constructor parameter', () => {
    const a = new Fp(new BN(18))
    const b = Fp.from(new BN(18))
    expect(new Fp(new BN(18))).toBeDefined()
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    expect(a).toBeInstanceOf(Fp)
    expect(b).toBeInstanceOf(Fp)
    expect(constant.eq(a)).toBe(true)
    expect(constant.eq(b)).toBe(true)
  })
  it('should accept itself for its constructor parameter', () => {
    const a = new Fp(new Fp(18))
    const b = Fp.from(new Fp(18))
    expect(new Fp(new Fp(18))).toBeDefined()
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    expect(a).toBeInstanceOf(Fp)
    expect(b).toBeInstanceOf(Fp)
    expect(constant.eq(a)).toBe(true)
    expect(constant.eq(b)).toBe(true)
  })
})
describe('cyclic group', () => {
  it('a + (-a) = 0', () => {
    const a = new Fp(18)
    const b = new Fp(-18)
    expect(a.add(b).isZero()).toBe(true)
  })
  it('a >= 0 and -a >= 0', () => {
    const a = new Fp(18)
    const b = new Fp(-18)
    expect(a.gtn(0)).toBe(true)
    expect(b.gtn(0)).toBe(true)
  })
  it('a - b > a when b > a', () => {
    const a = new Fp(18)
    const b = new Fp(20)
    expect(a.sub(b).gt(a)).toBe(true)
  })
})
