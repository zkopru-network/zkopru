import BN from 'bn.js'
import { Bytes32, Uint256, Address } from 'soltypes'
import RedBN from './types/redbn'

export type F = number | string | number[] | Uint8Array | Buffer | BN

export class Fp extends BN {
  static ORDER = new BN(
    '21888242871839275222246405745257275088548364400416034343698204186575808495617',
  )

  static half = Fp.from(Fp.ORDER.shrn(1))

  static zero = Fp.from(0)

  static one = Fp.from(1)

  static Red = BN.red(Fp.ORDER)

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
      super(n.mod(Fp.ORDER).add(Fp.ORDER), base, endian)
    } else {
      super(n.mod(Fp.ORDER), base, endian)
    }
    Object.setPrototypeOf(this, Fp.prototype)
  }

  static from(x: F): Fp {
    if (x === undefined) return new Fp(0)
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
    return n.lt(Fp.ORDER)
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

  toTwos(width: number): Fp {
    return Fp.from(super.toTwos(width))
  }

  fromTwos(width: number): Fp {
    return Fp.from(super.fromTwos(width))
  }

  neg(): Fp {
    return Fp.from(super.neg())
  }

  ineg(): Fp {
    return Fp.from(super.ineg())
  }

  abs(): Fp {
    return Fp.from(super.abs())
  }

  iabs(): Fp {
    return Fp.from(super.iabs())
  }

  add(f: F): Fp {
    return Fp.from(super.add(Fp.from(f)))
  }

  iadd(f: F): Fp {
    return Fp.from(super.iadd(Fp.from(f)))
  }

  addn(n: number): Fp {
    return Fp.from(super.addn(n))
  }

  iaddn(n: number): Fp {
    return Fp.from(super.iaddn(n))
  }

  sub(f: F): Fp {
    return Fp.from(super.sub(Fp.from(f)))
  }

  isub(f: F): Fp {
    return Fp.from(super.isub(Fp.from(f)))
  }

  subn(n: number): Fp {
    return Fp.from(super.subn(n))
  }

  isubn(n: number): Fp {
    return Fp.from(super.isubn(n))
  }

  mul(f: F): Fp {
    return Fp.from(super.mul(Fp.from(f)))
  }

  imul(f: F): Fp {
    return Fp.from(super.imul(Fp.from(f)))
  }

  muln(n: number): Fp {
    return Fp.from(super.muln(n))
  }

  imuln(n: number): Fp {
    return Fp.from(super.imuln(n))
  }

  sqr(): Fp {
    return Fp.from(super.sqr())
  }

  isqr(): Fp {
    return Fp.from(super.isqr())
  }

  pow(f: F): Fp {
    return Fp.from(super.pow(Fp.from(f)))
  }

  div(f: F): Fp {
    return Fp.from(super.div(Fp.from(f)))
  }

  divn(n: number): Fp {
    return Fp.from(super.divn(n))
  }

  mod(f: F): Fp {
    return Fp.from(super.mod(Fp.from(f)))
  }

  umod(f: F): Fp {
    return Fp.from(super.umod(Fp.from(f)))
  }

  divRound(f: F): Fp {
    return Fp.from(super.divRound(Fp.from(f)))
  }

  or(f: F): Fp {
    return Fp.from(super.or(Fp.from(f)))
  }

  ior(f: F): Fp {
    return Fp.from(super.ior(Fp.from(f)))
  }

  uor(f: F): Fp {
    return Fp.from(super.uor(Fp.from(f)))
  }

  iuor(f: F): Fp {
    return Fp.from(super.iuor(Fp.from(f)))
  }

  and(f: F): Fp {
    return Fp.from(super.and(Fp.from(f)))
  }

  iand(f: F): Fp {
    return Fp.from(super.iand(Fp.from(f)))
  }

  uand(f: F): Fp {
    return Fp.from(super.uand(Fp.from(f)))
  }

  iuand(f: F): Fp {
    return Fp.from(super.iuand(Fp.from(f)))
  }

  andln(n: number): Fp {
    return Fp.from(super.andln(n))
  }

  xor(f: F): Fp {
    return Fp.from(super.xor(Fp.from(f)))
  }

  ixor(f: F): Fp {
    return Fp.from(super.ixor(Fp.from(f)))
  }

  uxor(f: F): Fp {
    return Fp.from(super.uxor(Fp.from(f)))
  }

  iuxor(f: F): Fp {
    return Fp.from(super.iuxor(Fp.from(f)))
  }

  setn(n: number): Fp {
    return Fp.from(super.setn(n))
  }

  shln(n: number): Fp {
    return Fp.from(super.shln(n))
  }

  ishln(n: number): Fp {
    return Fp.from(super.ishln(n))
  }

  ushln(n: number): Fp {
    return Fp.from(super.ushln(n))
  }

  iushln(n: number): Fp {
    return Fp.from(super.iushln(n))
  }

  shrn(n: number): Fp {
    return Fp.from(super.shrn(n))
  }

  ishrn(n: number): Fp {
    return Fp.from(super.ishrn(n))
  }

  ushrn(n: number): Fp {
    return Fp.from(super.ushrn(n))
  }

  iushrn(n: number): Fp {
    return Fp.from(super.iushrn(n))
  }

  maskn(n: number): Fp {
    return Fp.from(super.maskn(n))
  }

  imaskn(n: number): Fp {
    return Fp.from(super.imaskn(n))
  }

  bincn(n: number): Fp {
    return Fp.from(super.bincn(n))
  }

  notn(w: number): Fp {
    return Fp.from(super.notn(w))
  }

  inotn(w: number): Fp {
    return Fp.from(super.inotn(w))
  }

  gcd(f: F): Fp {
    return Fp.from(super.gcd(Fp.from(f)))
  }

  toRed(): RedBN {
    const r = new BN(this.toString()).toRed(Fp.Red)
    return r
  }
}
