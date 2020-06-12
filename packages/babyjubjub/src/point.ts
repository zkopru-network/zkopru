import { hexToBuffer, hexify } from '@zkopru/utils'
import bigInt, { BigInteger } from 'big-integer'
import * as snarkjs from 'snarkjs'
import * as circomlib from 'circomlib'
import createBlakeHash from 'blake-hash'
import { Field, F } from './field'

export class Point {
  x: Field

  y: Field

  constructor(x: Field, y: Field) {
    this.x = x
    this.y = y
    if (
      !circomlib.babyJub.inCurve([
        this.x.toIden3BigInt(),
        this.y.toIden3BigInt(),
      ])
    ) {
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

  static fromPrivKey(key: string | Buffer): Point {
    const buff: Buffer = typeof key === 'string' ? hexToBuffer(key) : key
    const result = circomlib.eddsa.prv2pub(buff)
    return Point.from(result[0].toString(), result[1].toString())
  }

  static getMultiplier(key: string): Field {
    const sBuff = circomlib.eddsa.pruneBuffer(
      createBlakeHash('blake512')
        .update(key)
        .digest()
        .slice(0, 32),
    )
    return Field.from(
      snarkjs.bigInt
        .leBuff2int(sBuff)
        .shr(3)
        .toString(),
    )
  }

  static isOnJubjub(x: F, y: F): boolean {
    return circomlib.babyJub.inCurve([
      Field.from(x).toIden3BigInt(),
      Field.from(y).toIden3BigInt(),
    ])
  }

  encode(): Buffer {
    return circomlib.babyJub.packPoint([
      this.x.toIden3BigInt(),
      this.y.toIden3BigInt(),
    ])
  }

  toHex(): string {
    return hexify(this.encode())
  }

  toBigIntArr(): BigInteger[] {
    return [this.x.toIden3BigInt(), this.y.toIden3BigInt(), bigInt(1)]
  }

  add(p: Point): Point {
    const result = circomlib.babyJub.addPoint(
      [this.x.toIden3BigInt(), this.y.toIden3BigInt()],
      [p.x.toIden3BigInt(), p.y.toIden3BigInt()],
    )
    return Point.from(result[0].toString(), result[1].toString())
  }

  mul(n: F): Point {
    const result = circomlib.babyJub.mulPointEscalar(
      [this.x.toIden3BigInt(), this.y.toIden3BigInt()],
      Field.from(n).toIden3BigInt(),
    )
    return Point.from(result[0].toString(), result[1].toString())
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

export function signEdDSA({
  msg,
  privKey,
}: {
  msg: F
  privKey: Buffer | string
}): EdDSA {
  const buff: Buffer =
    typeof privKey === 'string' ? hexToBuffer(privKey) : privKey
  const result = circomlib.eddsa.signPoseidon(
    buff,
    Field.from(msg).toIden3BigInt(),
  )
  return {
    R8: Point.from(result.R8[0].toString(), result.R8[1].toString()),
    S: Field.from(result.S.toString()),
  }
}

export function verifyEdDSA(msg: F, sig: EdDSA, pubKey: Point): boolean {
  const result = circomlib.eddsa.verifyPoseidon(
    Field.from(msg).toIden3BigInt(),
    {
      R8: [sig.R8.x.toIden3BigInt(), sig.R8.y.toIden3BigInt()],
      S: sig.S.toIden3BigInt(),
    },
    [pubKey.x.toIden3BigInt(), pubKey.y.toIden3BigInt()],
  )
  return result
}
