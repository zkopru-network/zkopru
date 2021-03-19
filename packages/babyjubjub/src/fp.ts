/* global BigInt */
import BN from 'bn.js'
import { FiniteField } from './finite-field'
import RedBN from './types/redbn'

export type F = number | string | number[] | Uint8Array | Buffer | BN

// Scalar field of Baby Jubjub
const p = new BN(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617',
)

export class Fp extends FiniteField {
  constructor(number: F, base?: number | 'hex', endian?: BN.Endianness) {
    super(number, p, base, endian)
  }

  static from(x: F): Fp {
    if (x === undefined) return new Fp(0)
    if (x instanceof Fp && x.order.eq(p)) {
      return x
    }
    return new Fp(x)
  }

  static strictFrom(x: F): Fp {
    if (!Fp.inRange(x)) throw Error('Not in range')
    return Fp.from(x)
  }

  static toBN(x: F): BN {
    if (typeof x === 'string' && x.startsWith('0x')) {
      return new BN(x.substr(2), 16)
    }
    return new BN(x)
  }

  static fromBuffer(buff: Buffer): Fp {
    return Fp.from(`0x${buff.toString('hex')}`)
  }

  static inRange(x: F): boolean {
    let n: BN
    if (x instanceof BN) {
      n = x
    } else if (typeof x === 'string' && x.startsWith('0x')) {
      n = new BN(x.substr(2), 16)
    } else {
      n = new BN(x)
    }
    return n.lt(p)
  }

  static zero = Fp.from(0)

  static one = Fp.from(1)

  static half = p.shrn(1)

  static MAX = p

  static Red = BN.red(p)

  toRed(): RedBN {
    const r = (new BN(this.toString())).toRed(Fp.Red)
    return r
  }
}
