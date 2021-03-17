/* global BigInt */
import BN from 'bn.js'
import { FiniteField } from './finite-field'

export type F = number | string | number[] | Uint8Array | Buffer | BN

// Scalar field of Baby Jubjub
const r = new BN(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617',
)

export class Fr extends FiniteField {
  constructor(number: F, base?: number | 'hex', endian?: BN.Endianness) {
    super(number, r, base, endian)
  }

  static from(x: F): Fr {
    if (x === undefined) return new Fr(0)
    if (x instanceof FiniteField && x.order.eq(r)) {
      return x
    }
    return new Fr(x)
  }

  static strictFrom(x: F): Fr {
    if (!Fr.inRange(x)) throw Error('Not in range')
    return Fr.from(x)
  }

  static toBN(x: F): BN {
    if (typeof x === 'string' && x.startsWith('0x')) {
      return new BN(x.substr(2), 16)
    }
    return new BN(x)
  }

  static fromBuffer(buff: Buffer): Fr {
    return Fr.from(`0x${buff.toString('hex')}`)
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
    return n.lt(r)
  }

  static zero = Fr.from(0)

  static one = Fr.from(1)

  static MAX = r
}
