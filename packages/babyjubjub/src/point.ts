/* global BigInt */
import { hexToBuffer, hexify } from '@zkopru/utils'
import * as ffjs from 'ffjavascript'
import * as circomlib from 'circomlib'
import createBlakeHash from 'blake-hash'
import { F } from './finite-field'
import { Fp } from './fp'
import { Fr } from './fr'
import BN from 'bn.js'

export class Point {
  x: Fp

  y: Fp

  constructor(x: Fp, y: Fp) {
    this.x = x
    this.y = y
    if (!circomlib.babyJub.inCurve([this.x.toBigInt(), this.y.toBigInt()])) {
      throw new Error('Given point is not on the Babyjubjub curve')
    }
  }

  static zero = Point.from(0, 1)

  static from(x: F, y: F) {
    return new Point(Fp.from(x), Fp.from(y))
  }

  static fromY(y: F, neg: boolean): Point {
    const redY = Fp.from(y).toRed()
    const y2 = redY.redSqr()
    const D = Point.D.toRed()
    const numerator = Fp.one.toRed().redSub(y2)
    const denominator = Point.A.toRed()
      .redSub(D.redMul(y2))
      .redInvm()
    const x = numerator.redMul(denominator).redSqrt().fromRed()
    if (x.gt(Fp.half) === neg) {
      return Point.from(x.neg(), y)
    } else {
      return Point.from(x, y)
    }
  }

  static fromHex(hex: string) {
    const buffer = hexToBuffer(hex)
    return Point.decode(buffer)
  }

  static decode(packed: Buffer): Point {
    const n = new BN(packed)
    const y = n.and(new BN(1).shln(255).subn(1))
    const positive = n.eq(y)
    return Point.fromY(y, !positive)
  }

  static generate(n: F): Point {
    return Point.BASE8.mul(Fr.from(n))
  }

  /**
   * @returns getMultiplier(key)*G
   */
  static fromPrivKey(key: string | Buffer): Point {
    const buff: Buffer = typeof key === 'string' ? hexToBuffer(key) : key
    const result = circomlib.eddsa.prv2pub(buff)
    return Point.from(result[0].toString(), result[1].toString())
  }

  static getMultiplier(key: string | Buffer): Fr {
    const buff: Buffer = typeof key === 'string' ? hexToBuffer(key) : key
    const sBuff = Buffer.from(
      createBlakeHash('blake512')
        .update(buff)
        .digest()
        .slice(0, 32),
    )
    sBuff[0] &= 0xf8
    sBuff[31] &= 0x7f
    sBuff[31] |= 0x40
    const s = ffjs.utils.leBuff2int(sBuff)
    const multiplier = ffjs.Scalar.shr(s, 3)
    return Fr.from(multiplier)
  }

  static isOnJubjub(x: F, y: F): boolean {
    return circomlib.babyJub.inCurve([
      Fp.from(x).toBigInt(),
      Fp.from(y).toBigInt(),
    ])
  }

  encode(): Buffer {
    const neg = this.x.gt(Fp.half)
    const packed: BN = neg ? this.y : new BN(1).shln(255).or(this.y)
    return packed.toBuffer('be', 32)
  }

  toHex(): string {
    return hexify(this.encode(), 32)
  }

  toBigIntArr(): bigint[] {
    return [this.x.toBigInt(), this.y.toBigInt(), BigInt(1)]
  }

  add(p: Point): Point {
    const result = circomlib.babyJub.addPoint(
      [this.x.toBigInt(), this.y.toBigInt()],
      [p.x.toBigInt(), p.y.toBigInt()],
    )
    return Point.from(result[0].toString(), result[1].toString())
  }

  mul(n: F): Point {
    const result = circomlib.babyJub.mulPointEscalar(
      [this.x.toBigInt(), this.y.toBigInt()],
      Fr.from(n).toBigInt(),
    )
    return Point.from(result[0].toString(), result[1].toString())
  }

  eq(p: Point): boolean {
    return p.toHex() === this.toHex()
  }

  static GENERATOR: Point = Point.from(
    circomlib.babyJub.Generator[0].toString(),
    circomlib.babyJub.Generator[1].toString(),
  )

  static BASE8: Point = Point.from(
    circomlib.babyJub.Base8[0].toString(),
    circomlib.babyJub.Base8[1].toString(),
  )

  static ORDER: bigint = circomlib.babyJub.order

  static SUB_ORDER: bigint = circomlib.babyJub.subOrder

  static PRIME: bigint = circomlib.babyJub.p

  static A = Fp.from(circomlib.babyJub.A)

  static D = Fp.from(circomlib.babyJub.D)
}
