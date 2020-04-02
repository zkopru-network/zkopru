import { BigNumber } from 'big-integer'
import * as snarkjs from 'snarkjs'
import * as circomlib from 'circomlib'
import createBlakeHash from 'blake-hash'
import { Field } from './field'

export class Point {
  x: Field

  y: Field

  constructor(x: Field, y: Field) {
    this.x = x
    this.y = y
    if (!circomlib.babyJub.inCurve([this.x.val, this.y.val])) {
      throw new Error('Given point is not on the Babyjubjub curve')
    }
  }

  static zero = Point.from(0, 1)

  static from(x: BigNumber, y: BigNumber) {
    return new Point(Field.from(x), Field.from(y))
  }

  static decode(packed: Buffer): Point {
    const point = circomlib.babyJub.unpackPoint(packed)
    return Point.from(point[0], point[1])
  }

  static generate(n: Field): Point {
    return Point.BASE8.mul(n)
  }

  static fromPrivKey(key: string | Buffer): Point {
    const result = circomlib.eddsa.prv2pub(key)
    return Point.from(result[0], result[1])
  }

  static getMultiplier(key: string): Field {
    const sBuff = circomlib.eddsa.pruneBuffer(
      createBlakeHash('blake512')
        .update(key)
        .digest()
        .slice(0, 32),
    )
    return Field.from(snarkjs.bigInt.leBuff2int(sBuff).shr(3))
  }

  static isOnJubjub(x: Field, y: Field) {
    return circomlib.babyJub.inCurve([x.val, y.val])
  }

  encode(): Buffer {
    return circomlib.babyJub.packPoint([this.x.val, this.y.val])
  }

  add(p: Point): Point {
    const result = circomlib.babyJub.addPoint(
      [this.x.val, this.y.val],
      [p.x.val, p.y.val],
    )
    return Point.from(result[0], result[1])
  }

  mul(n: Field): Point {
    const result = circomlib.babyJub.mulPointEscalar(
      [this.x.val, this.y.val],
      n,
    )
    return Point.from(result[0], result[1])
  }

  static GENERATOR: Point = Point.from(
    circomlib.babyJub.Generator[0],
    circomlib.babyJub.Generator[1],
  )

  static BASE8: Point = Point.from(
    circomlib.babyJub.Base8[0],
    circomlib.babyJub.Base8[1],
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
  privKey: string
}): EdDSA {
  const result = circomlib.eddsa.signPoseidon(privKey, msg.val)
  return {
    R8: Point.from(result.R8[0], result.R8[1]),
    S: result.S,
  }
}

export function verifyEdDSA(msg: Field, sig: EdDSA, pubKey: Point): boolean {
  const result = circomlib.eddsa.verifyPoseidon(
    msg,
    { R8: [sig.R8.x, sig.R8.y], S: sig.S },
    [pubKey.x.val, pubKey.y.val],
  )
  return result
}
