/* global BigInt */
import { hexToBuffer, hexify } from '@zkopru/utils'
import * as ffjs from 'ffjavascript'
import * as circomlib from 'circomlib'
import createBlakeHash from 'blake-hash'
import { Field, F } from './field'

export class Point {
  x: Field

  y: Field

  constructor(x: Field, y: Field) {
    this.x = x
    this.y = y
    if (!circomlib.babyJub.inCurve([this.x.toBigInt(), this.y.toBigInt()])) {
      throw new Error('Given point is not on the Babyjubjub curve')
    }
  }

  static zero = Point.from(0, 1)

  static from(x: F, y: F) {
    return new Point(Field.from(x), Field.from(y))
  }

  static fromHex(hex: string) {
    const buffer = hexToBuffer(hex)
    return Point.decode(buffer)
  }

  static decode(packed: Buffer): Point {
    const point = circomlib.babyJub.unpackPoint(packed)
    return Point.from(point[0].toString(), point[1].toString())
  }

  static generate(n: F): Point {
    return Point.BASE8.mul(Field.from(n))
  }

  /**
   * @returns getMultiplier(key)*G
   */
  static fromPrivKey(key: string | Buffer): Point {
    const buff: Buffer = typeof key === 'string' ? hexToBuffer(key) : key
    const result = circomlib.eddsa.prv2pub(buff)
    return Point.from(result[0].toString(), result[1].toString())
  }

  static getMultiplier(key: string | Buffer): Field {
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
    return Field.from(multiplier)
  }

  static isOnJubjub(x: F, y: F): boolean {
    return circomlib.babyJub.inCurve([
      Field.from(x).toBigInt(),
      Field.from(y).toBigInt(),
    ])
  }

  encode(): Buffer {
    return circomlib.babyJub.packPoint([this.x.toBigInt(), this.y.toBigInt()])
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
      Field.from(n).toBigInt(),
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

  static A = circomlib.babyJub

  static D = circomlib.babyJub
}

export interface EdDSA {
  R8: Point
  S: Field
}

export function verifyEdDSA(msg: F, sig: EdDSA, pubKey: Point): boolean {
  const result = circomlib.eddsa.verifyPoseidon(
    Field.from(msg).toBigInt(),
    {
      R8: [sig.R8.x.toBigInt(), sig.R8.y.toBigInt()],
      S: sig.S.toBigInt(),
    },
    [pubKey.x.toBigInt(), pubKey.y.toBigInt()],
  )
  return result
}

export function signEdDSA({
  msg,
  privKey,
}: {
  msg: F
  privKey: Buffer | string
}): EdDSA {
  const buff: Buffer =
    typeof privKey === 'string' ? hexToBuffer(privKey) : privKey
  const result = circomlib.eddsa.signPoseidon(buff, Field.from(msg).toBigInt())
  return {
    R8: Point.from(result.R8[0].toString(), result.R8[1].toString()),
    S: Field.from(result.S.toString()),
  }
}
