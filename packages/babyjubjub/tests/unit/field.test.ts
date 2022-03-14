/* eslint-disable jest/no-hooks */
import { BigNumber } from 'ethers'
import { Fp } from '~babyjubjub'

describe('finite field', () => {
  let constant: Fp
  beforeAll(() => {
    constant = Fp.from(18)
  })
  it('should accept number for its constructor parameter', () => {
    const a = Fp.from(18)
    const b = Fp.from('18')
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    expect(a).toBeInstanceOf(Fp)
    expect(b).toBeInstanceOf(Fp)
    expect(constant.eq(a)).toBe(true)
    expect(constant.eq(b)).toBe(true)
  })
  it('should accept hex string for its constructor parameter', () => {
    const a = Fp.from('18')
    const b = Fp.from('0x12')
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    expect(a).toBeInstanceOf(Fp)
    expect(b).toBeInstanceOf(Fp)
    expect(constant.eq(a)).toBe(true)
    expect(constant.eq(b)).toBe(true)
  })
  it('should accept bigint for its constructor parameter', () => {
    const a = Fp.from(BigInt(18))
    const b = Fp.from('0x12')
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    expect(a).toBeInstanceOf(Fp)
    expect(b).toBeInstanceOf(Fp)
    expect(constant.eq(a)).toBe(true)
    expect(constant.eq(b)).toBe(true)
  })
  it('should return same hex', () => {
    console.log('should return same hex test')
    const f = Fp.from('0xabcd1234abcd1234')
    console.log('vall 1')
    console.log(f.toHexString())
    console.log('vall 2')
    console.log(f.toHexString(8))
    console.log('vall 3')
    console.log(f.toHexString(8))
    console.log(f.toHexString(8))
    expect(f.toHexString(8)).toStrictEqual('0xabcd1234abcd1234')
  })
  it('should return cyclic hex for a number beyond the field range', () => {
    const f = Fp.from(
      '0xabcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234',
    )
    expect(f.toHexString(32)).not.toStrictEqual(
      '0xabcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234',
    )
  })
  it('should accept Buffer obj for its constructor parameter', () => {
    const a = Fp.from(Buffer.from('12', 'hex'))
    const b = Fp.from('0x12')
    expect(Fp.from(Buffer.from('12', 'hex'))).toBeDefined()
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    expect(a).toBeInstanceOf(Fp)
    expect(b).toBeInstanceOf(Fp)
    expect(constant.eq(a)).toBe(true)
    expect(constant.eq(b)).toBe(true)
  })
  it('should accept BigNumber object for its constructor parameter', () => {
    const a = Fp.from(BigNumber.from(18))
    const b = Fp.from(18)
    expect(Fp.from(18)).toBeDefined()
    expect(a).toBeDefined()
    expect(b).toBeDefined()
    expect(a).toBeInstanceOf(Fp)
    expect(b).toBeInstanceOf(Fp)
    expect(constant.eq(a)).toBe(true)
    expect(constant.eq(b)).toBe(true)
  })
  it('should accept itself for its constructor parameter', () => {
    const a = Fp.from(Fp.from(18))
    const b = Fp.from(a)
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
    const a = Fp.from(18)
    const b = Fp.from(-18)
    expect(a.add(b).isZero()).toBe(true)
  })
  it('a >= 0 and -a >= 0', () => {
    const a = Fp.from(18)
    const b = Fp.from(-18)
    expect(a.gt(0)).toBe(true)
    expect(b.gt(0)).toBe(true)
  })
  it('a - b > a when b > a', () => {
    const a = Fp.from(18)
    const b = Fp.from(20)
    expect(a.sub(b).gt(a)).toBe(true)
  })
})
