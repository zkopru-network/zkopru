import { Logger } from '@ethersproject/logger'
import BN from 'bn.js'
import { BigNumber, BigNumberish } from 'ethers'
import { Bytes32, Uint256, Address } from 'soltypes'
import RedBN from './types/redbn'

const logger = new Logger('babyjubjub/2.0.0')
const _constructorGuard = {}
export class Fr implements BigNumber {
  static ORDER = BigNumber.from(
    '2736030358979909402780800718157159386076813972158567259200215660948447373041',
  )

  static half = Fr.from(Fr.ORDER.shr(1))

  static zero = Fr.from(0)

  static one = Fr.from(1)

  static Red = BN.red(new BN(Fr.ORDER.toString()))

  readonly _hex: string

  readonly _isBigNumber: boolean

  constructor(constructorGuard: any, hex: string) {
    logger.checkNew(new.target, BigNumber)

    if (constructorGuard !== _constructorGuard) {
      logger.throwError(
        'cannot call constructor directly; use Fr.from',
        Logger.errors.UNSUPPORTED_OPERATION,
        {
          operation: 'new (Fr)',
        },
      )
    }
    this._hex = hex
    this._isBigNumber = true
    Object.freeze(this)
  }

  static from(number: BigNumberish): Fr {
    const n: BigNumber = BigNumber.from(number)
    let val: BigNumber
    if (n.isNegative()) {
      val = n.mod(Fr.ORDER).add(Fr.ORDER)
    } else {
      val = n.mod(Fr.ORDER)
    }
    return new Fr(_constructorGuard, val.toHexString())
  }

  static strictFrom(x: BigNumberish): Fr {
    if (!Fr.inRange(x)) throw Error('Not in range')
    return Fr.from(x)
  }

  static fromBuffer(buff: Buffer): Fr {
    return Fr.from(`0x${buff.toString('hex')}`)
  }

  static inRange(x: BigNumberish): boolean {
    return BigNumber.from(x).lt(Fr.ORDER)
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

  toTwos(width: number): Fr {
    return Fr.from(this.toBigNumber().toTwos(width))
  }

  fromTwos(width: number): Fr {
    return Fr.from(this.toBigNumber().fromTwos(width))
  }

  abs(): Fr {
    return Fr.from(this.toBigNumber().abs())
  }

  add(f: BigNumberish): Fr {
    return Fr.from(this.toBigNumber().add(f))
  }

  sub(f: BigNumberish): Fr {
    return Fr.from(this.toBigNumber().sub(f))
  }

  mul(f: BigNumberish): Fr {
    return Fr.from(this.toBigNumber().mul(Fr.from(f)))
  }

  pow(f: BigNumberish): Fr {
    return Fr.from(this.toBigNumber().pow(Fr.from(f)))
  }

  div(f: BigNumberish): Fr {
    return Fr.from(this.toBigNumber().div(Fr.from(f)))
  }

  mod(f: BigNumberish): Fr {
    return Fr.from(this.toBigNumber().mod(Fr.from(f)))
  }

  or(f: BigNumberish): Fr {
    return Fr.from(this.toBigNumber().or(Fr.from(f)))
  }

  and(f: BigNumberish): Fr {
    return Fr.from(this.toBigNumber().and(Fr.from(f)))
  }

  xor(f: BigNumberish): Fr {
    return Fr.from(this.toBigNumber().xor(Fr.from(f)))
  }

  mask(n: number): Fr {
    return Fr.from(this.toBigNumber().mask(n))
  }

  shl(value: number): Fr {
    return Fr.from(this.toBigNumber().shl(value))
  }

  shr(value: number): Fr {
    return Fr.from(this.toBigNumber().shr(value))
  }

  neg(): Fr {
    return Fr.from(
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
    const r = new BN(this.toString()).toRed(Fr.Red)
    return r
  }
}
