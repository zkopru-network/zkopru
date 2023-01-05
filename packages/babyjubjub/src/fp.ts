import { Logger } from '@ethersproject/logger'
import BN from 'bn.js'
import { BigNumber, BigNumberish } from 'ethers'
import { Bytes32, Uint256, Address } from 'soltypes'
import RedBN from './types/redbn'

const logger = new Logger('babyjubjub/2.0.0')
const _constructorGuard = {}
export class Fp implements BigNumber {
  static ORDER = BigNumber.from(
    '21888242871839275222246405745257275088548364400416034343698204186575808495617',
  )

  static half = Fp.from(Fp.ORDER.shr(1))

  static zero = Fp.from(0)

  static one = Fp.from(1)

  static Red = BN.red(new BN(Fp.ORDER.toString()))

  readonly _hex: string

  readonly _isBigNumber: boolean

  constructor(constructorGuard: any, hex: string) {
    logger.checkNew(new.target, BigNumber)

    if (constructorGuard !== _constructorGuard) {
      logger.throwError(
        'cannot call constructor directly; use Fp.from',
        Logger.errors.UNSUPPORTED_OPERATION,
        {
          operation: 'new (Fp)',
        },
      )
    }
    this._hex = hex
    this._isBigNumber = true
    Object.freeze(this)
  }

  static from(number: BigNumberish): Fp {
    const n: BigNumber = BigNumber.from(number)
    const val = n.mod(Fp.ORDER)
    return new Fp(_constructorGuard, val.toHexString())
  }

  static strictFrom(x: BigNumberish): Fp {
    if (!Fp.inRange(x)) throw Error('Not in range')
    return Fp.from(x)
  }

  static fromBuffer(buff: Buffer): Fp {
    return Fp.from(`0x${buff.toString('hex')}`)
  }

  static inRange(x: BigNumberish): boolean {
    return BigNumber.from(x).lt(Fp.ORDER)
  }

  toBuffer(endian?: 'be' | 'le', length?: number): Buffer {
    return new BN(this.toString()).toArrayLike(Buffer, endian, length)
  }

  toJSON(): string {
    return this.toHexString()
  }

  toHexString(byteLength?: number): string {
    if (byteLength) {
      return `0x${this.toBuffer('be', byteLength).toString('hex')}`
    }
    return this.toBigNumber().toHexString()
  }

  toBytes32(): Bytes32 {
    return new Bytes32(this.toHexString())
  }

  toUint256(): Uint256 {
    return this.toBytes32().toUint()
  }

  toAddress(): Address {
    return new Address(this.toHexString(20))
  }

  toTwos(width: number): Fp {
    return Fp.from(this.toBigNumber().toTwos(width))
  }

  fromTwos(width: number): Fp {
    return Fp.from(this.toBigNumber().fromTwos(width))
  }

  abs(): Fp {
    return Fp.from(this.toBigNumber().abs())
  }

  add(f: BigNumberish): Fp {
    return Fp.from(this.toBigNumber().add(f))
  }

  sub(f: BigNumberish): Fp {
    return Fp.from(this.toBigNumber().sub(f))
  }

  mul(f: BigNumberish): Fp {
    return Fp.from(this.toBigNumber().mul(Fp.from(f)))
  }

  pow(f: BigNumberish): Fp {
    return Fp.from(this.toBigNumber().pow(Fp.from(f)))
  }

  div(f: BigNumberish): Fp {
    return Fp.from(this.toBigNumber().div(Fp.from(f)))
  }

  mod(f: BigNumberish): Fp {
    return Fp.from(this.toBigNumber().mod(Fp.from(f)))
  }

  or(f: BigNumberish): Fp {
    return Fp.from(this.toBigNumber().or(Fp.from(f)))
  }

  and(f: BigNumberish): Fp {
    return Fp.from(this.toBigNumber().and(Fp.from(f)))
  }

  xor(f: BigNumberish): Fp {
    return Fp.from(this.toBigNumber().xor(Fp.from(f)))
  }

  mask(n: number): Fp {
    return Fp.from(this.toBigNumber().mask(n))
  }

  shl(value: number): Fp {
    return Fp.from(this.toBigNumber().shl(value))
  }

  shr(value: number): Fp {
    return Fp.from(this.toBigNumber().shr(value))
  }

  neg(): Fp {
    return Fp.from(
      this._hex.startsWith('-') ? this._hex.slice(1) : `-${this._hex}`,
    )
  }

  eq(other: BigNumberish): boolean {
    return this.toBigNumber().eq(other)
  }

  lt(other: BigNumberish): boolean {
    return this.toBigNumber().lt(other)
  }

  lte(other: BigNumberish): boolean {
    return this.toBigNumber().lte(other)
  }

  gt(other: BigNumberish): boolean {
    return this.toBigNumber().gt(other)
  }

  gte(other: BigNumberish): boolean {
    return this.toBigNumber().gte(other)
  }

  isNegative(): boolean {
    return this.toBigNumber().isNegative()
  }

  isZero(): boolean {
    return this.toBigNumber().isZero()
  }

  toNumber(): number {
    return this.toBigNumber().toNumber()
  }

  toBigInt(): bigint {
    return this.toBigNumber().toBigInt()
  }

  toBigNumber(): BigNumber {
    return BigNumber.from(this._hex)
  }

  toString(): string {
    return BigNumber.from(this._hex).toString()
  }

  toRed(): RedBN {
    const r = new BN(this.toString()).toRed(Fp.Red)
    return r
  }
}
