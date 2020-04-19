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
    const buffer = Buffer.from(hex, 'hex')
    return Point.decode(buffer)
  }

  static decode(packed: Buffer): Point {
    const point = circomlib.babyJub.unpackPoint(packed)
    return Point.from(point[0].toString(), point[1].toString())
  }

  static generate(n: Field): Point {
    return Point.BASE8.mul(n)
  }

  static fromPrivKey(key: string | Buffer): Point {
    const result = circomlib.eddsa.prv2pub(key)
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

  static isOnJubjub(x: Field, y: Field) {
    return circomlib.babyJub.inCurve([x.toIden3BigInt(), y.toIden3BigInt()])
  }

  encode(): Buffer {
    return circomlib.babyJub.packPoint([
      this.x.toIden3BigInt(),
      this.y.toIden3BigInt(),
    ])
  }

  toHex(): string {
    return this.encode().toString('hex')
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

  mul(n: Field): Point {
    const result = circomlib.babyJub.mulPointEscalar(
      [this.x.toIden3BigInt(), this.y.toIden3BigInt()],
      n,
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
  msg: Field
  privKey: Buffer | string
}): EdDSA {
  const result = circomlib.eddsa.signPoseidon(privKey, msg.toIden3BigInt())
  return {
    R8: Point.from(result.R8[0].toString(), result.R8[1].toString()),
    S: result.S,
  }
}

export function verifyEdDSA(msg: Field, sig: EdDSA, pubKey: Point): boolean {
  const result = circomlib.eddsa.verifyPoseidon(
    msg,
    { R8: [sig.R8.x, sig.R8.y], S: sig.S },
    [pubKey.x.toIden3BigInt(), pubKey.y.toIden3BigInt()],
  )
  return result
}
