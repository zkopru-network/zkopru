import BN from 'bn.js'
import { Bytes32, Uint256, Address } from 'soltypes'
import RedBN from './types/redbn'

export type F = number | string | number[] | Uint8Array | Buffer | BN

export class Fr extends BN {
  static ORDER = new BN(
    '2736030358979909402780800718157159386076813972158567259200215660948447373041',
  )

  static half = Fr.from(Fr.ORDER.shrn(1))

  static zero = Fr.from(0)

  static one = Fr.from(1)

  static Red = BN.red(Fr.ORDER)

  constructor(number: F, base?: number | 'hex', endian?: BN.Endianness) {
    let n: BN
    if (number instanceof BN) {
      n = new BN(number.toString())
    } else if (typeof number === 'string' && number.startsWith('0x')) {
      n = new BN(number.substr(2), 16, endian)
    } else {
      n = new BN(number, base, endian)
    }
    if (n.isNeg()) {
      super(n.mod(Fr.ORDER).add(Fr.ORDER), base, endian)
    } else {
      super(n.mod(Fr.ORDER), base, endian)
    }
    Object.setPrototypeOf(this, Fr.prototype)
  }

  static from(x: F): Fr {
    if (x === undefined) return new Fr(0)
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
    return n.lt(Fr.ORDER)
  }

  toBuffer(endian?: BN.Endianness, length?: number): Buffer {
    return this.toArrayLike(Buffer, endian, length)
  }

  addPrefixBit(bitLength: number): BN {
    const prefix = new BN(1).shln(bitLength)
    if (this.gt(prefix)) throw Error('prefix bit is less than current value')
    return prefix.or(this)
  }

  toJSON(): string {
    return `0x${super.toJSON()}`
  }

  toHex(byteLength?: number): string {
    if (byteLength) {
      return `0x${this.toBuffer('be', byteLength).toString('hex')}`
    }
    return `0x${this.toString('hex')}`
  }

  toBytes32(): Bytes32 {
    return new Bytes32(`0x${this.toString(16, 64)}`)
  }

  toUint256(): Uint256 {
    return this.toBytes32().toUint()
  }

  toAddress(): Address {
    return new Address(`0x${this.toString(16, 40)}`)
  }

  toBigInt(): bigint {
    return BigInt(this.toString())
    // return ffjs.utils.stringifyBigInts(this.toString())
  }

  toTwos(width: number): Fr {
    return Fr.from(super.toTwos(width))
  }

  fromTwos(width: number): Fr {
    return Fr.from(super.fromTwos(width))
  }

  neg(): Fr {
    return Fr.from(super.neg())
  }

  ineg(): Fr {
    return Fr.from(super.ineg())
  }

  abs(): Fr {
    return Fr.from(super.abs())
  }

  iabs(): Fr {
    return Fr.from(super.iabs())
  }

  add(f: F): Fr {
    return Fr.from(super.add(Fr.from(f)))
  }

  iadd(f: F): Fr {
    return Fr.from(super.iadd(Fr.from(f)))
  }

  addn(n: number): Fr {
    return Fr.from(super.addn(n))
  }

  iaddn(n: number): Fr {
    return Fr.from(super.iaddn(n))
  }

  sub(f: F): Fr {
    return Fr.from(super.sub(Fr.from(f)))
  }

  isub(f: F): Fr {
    return Fr.from(super.isub(Fr.from(f)))
  }

  subn(n: number): Fr {
    return Fr.from(super.subn(n))
  }

  isubn(n: number): Fr {
    return Fr.from(super.isubn(n))
  }

  mul(f: F): Fr {
    return Fr.from(super.mul(Fr.from(f)))
  }

  imul(f: F): Fr {
    return Fr.from(super.imul(Fr.from(f)))
  }

  muln(n: number): Fr {
    return Fr.from(super.muln(n))
  }

  imuln(n: number): Fr {
    return Fr.from(super.imuln(n))
  }

  sqr(): Fr {
    return Fr.from(super.sqr())
  }

  isqr(): Fr {
    return Fr.from(super.isqr())
  }

  pow(f: F): Fr {
    return Fr.from(super.pow(Fr.from(f)))
  }

  div(f: F): Fr {
    return Fr.from(super.div(Fr.from(f)))
  }

  divn(n: number): Fr {
    return Fr.from(super.divn(n))
  }

  mod(f: F): Fr {
    return Fr.from(super.mod(Fr.from(f)))
  }

  umod(f: F): Fr {
    return Fr.from(super.umod(Fr.from(f)))
  }

  divRound(f: F): Fr {
    return Fr.from(super.divRound(Fr.from(f)))
  }

  or(f: F): Fr {
    return Fr.from(super.or(Fr.from(f)))
  }

  ior(f: F): Fr {
    return Fr.from(super.ior(Fr.from(f)))
  }

  uor(f: F): Fr {
    return Fr.from(super.uor(Fr.from(f)))
  }

  iuor(f: F): Fr {
    return Fr.from(super.iuor(Fr.from(f)))
  }

  and(f: F): Fr {
    return Fr.from(super.and(Fr.from(f)))
  }

  iand(f: F): Fr {
    return Fr.from(super.iand(Fr.from(f)))
  }

  uand(f: F): Fr {
    return Fr.from(super.uand(Fr.from(f)))
  }

  iuand(f: F): Fr {
    return Fr.from(super.iuand(Fr.from(f)))
  }

  andln(n: number): Fr {
    return Fr.from(super.andln(n))
  }

  xor(f: F): Fr {
    return Fr.from(super.xor(Fr.from(f)))
  }

  ixor(f: F): Fr {
    return Fr.from(super.ixor(Fr.from(f)))
  }

  uxor(f: F): Fr {
    return Fr.from(super.uxor(Fr.from(f)))
  }

  iuxor(f: F): Fr {
    return Fr.from(super.iuxor(Fr.from(f)))
  }

  setn(n: number): Fr {
    return Fr.from(super.setn(n))
  }

  shln(n: number): Fr {
    return Fr.from(super.shln(n))
  }

  ishln(n: number): Fr {
    return Fr.from(super.ishln(n))
  }

  ushln(n: number): Fr {
    return Fr.from(super.ushln(n))
  }

  iushln(n: number): Fr {
    return Fr.from(super.iushln(n))
  }

  shrn(n: number): Fr {
    return Fr.from(super.shrn(n))
  }

  ishrn(n: number): Fr {
    return Fr.from(super.ishrn(n))
  }

  ushrn(n: number): Fr {
    return Fr.from(super.ushrn(n))
  }

  iushrn(n: number): Fr {
    return Fr.from(super.iushrn(n))
  }

  maskn(n: number): Fr {
    return Fr.from(super.maskn(n))
  }

  imaskn(n: number): Fr {
    return Fr.from(super.imaskn(n))
  }

  bincn(n: number): Fr {
    return Fr.from(super.bincn(n))
  }

  notn(w: number): Fr {
    return Fr.from(super.notn(w))
  }

  inotn(w: number): Fr {
    return Fr.from(super.inotn(w))
  }

  gcd(f: F): Fr {
    return Fr.from(super.gcd(Fr.from(f)))
  }

  toRed(): RedBN {
    const r = new BN(this.toString()).toRed(Fr.Red)
    return r
  }
}
