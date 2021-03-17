/* global BigInt */
import BN from 'bn.js'
import { Bytes32, Uint256, Address } from 'soltypes'

export type F = number | string | number[] | Uint8Array | Buffer | BN

export class FiniteField extends BN {
  order: BN

  constructor(
    number: F,
    order: BN,
    base?: number | 'hex',
    endian?: BN.Endianness,
  ) {
    if (number instanceof BN) {
      super(number.toString())
    } else if (typeof number === 'string' && number.startsWith('0x')) {
      super(number.substr(2), 16, endian)
    } else {
      super(number, base, endian)
    }
    this.order = order
    if (super.gte(order)) {
      // console.warn('Exceeds babyjubjub field range')
      return FiniteField.from(super.sub(order), order)
    }
    if (super.isNeg()) {
      return FiniteField.from(super.add(order), order)
    }
  }

  static from(x: F, order: BN): FiniteField {
    if (x === undefined) return new FiniteField(0, order)
    if (x instanceof FiniteField) {
      return x
    }
    return new FiniteField(x, order)
  }

  static strictFrom(x: F, order: BN): FiniteField {
    if (!FiniteField.inRange(x, order)) throw Error('Not in range')
    return FiniteField.from(x, order)
  }

  static toBN(x: F): BN {
    if (typeof x === 'string' && x.startsWith('0x')) {
      return new BN(x.substr(2), 16)
    }
    return new BN(x)
  }

  static fromBuffer(buff: Buffer, order: BN): FiniteField {
    return FiniteField.from(`0x${buff.toString('hex')}`, order)
  }

  static inRange(x: F, order: BN): boolean {
    let n: BN
    if (x instanceof BN) {
      n = x
    } else if (typeof x === 'string' && x.startsWith('0x')) {
      n = new BN(x.substr(2), 16)
    } else {
      n = new BN(x)
    }
    return n.lt(order)
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

  toTwos(width: number): FiniteField {
    return FiniteField.from(super.toTwos(width), this.order)
  }

  fromTwos(width: number): FiniteField {
    return FiniteField.from(super.fromTwos(width), this.order)
  }

  neg(): FiniteField {
    return FiniteField.from(super.neg(), this.order)
  }

  ineg(): FiniteField {
    return FiniteField.from(super.ineg(), this.order)
  }

  abs(): FiniteField {
    return FiniteField.from(super.abs(), this.order)
  }

  iabs(): FiniteField {
    return FiniteField.from(super.iabs(), this.order)
  }

  add(f: F): FiniteField {
    return FiniteField.from(
      super.add(FiniteField.from(f, this.order)),
      this.order,
    )
  }

  iadd(f: F): FiniteField {
    return FiniteField.from(
      super.iadd(FiniteField.from(f, this.order)),
      this.order,
    )
  }

  addn(n: number): FiniteField {
    return FiniteField.from(super.addn(n), this.order)
  }

  iaddn(n: number): FiniteField {
    return FiniteField.from(super.iaddn(n), this.order)
  }

  sub(f: F): FiniteField {
    return FiniteField.from(
      super.sub(FiniteField.from(f, this.order)),
      this.order,
    )
  }

  isub(f: F): FiniteField {
    return FiniteField.from(
      super.isub(FiniteField.from(f, this.order)),
      this.order,
    )
  }

  subn(n: number): FiniteField {
    return FiniteField.from(super.subn(n), this.order)
  }

  isubn(n: number): FiniteField {
    return FiniteField.from(super.isubn(n), this.order)
  }

  mul(f: F): FiniteField {
    return FiniteField.from(
      super.mul(FiniteField.from(f, this.order)),
      this.order,
    )
  }

  imul(f: F): FiniteField {
    return FiniteField.from(
      super.imul(FiniteField.from(f, this.order)),
      this.order,
    )
  }

  muln(n: number): FiniteField {
    return FiniteField.from(super.muln(n), this.order)
  }

  imuln(n: number): FiniteField {
    return FiniteField.from(super.imuln(n), this.order)
  }

  sqr(): FiniteField {
    return FiniteField.from(super.sqr(), this.order)
  }

  isqr(): FiniteField {
    return FiniteField.from(super.isqr(), this.order)
  }

  pow(f: F): FiniteField {
    return FiniteField.from(
      super.pow(FiniteField.from(f, this.order)),
      this.order,
    )
  }

  div(f: F): FiniteField {
    return FiniteField.from(
      super.div(FiniteField.from(f, this.order)),
      this.order,
    )
  }

  divn(n: number): FiniteField {
    return FiniteField.from(super.divn(n), this.order)
  }

  mod(f: F): FiniteField {
    return FiniteField.from(
      super.mod(FiniteField.from(f, this.order)),
      this.order,
    )
  }

  umod(f: F): FiniteField {
    return FiniteField.from(
      super.umod(FiniteField.from(f, this.order)),
      this.order,
    )
  }

  divRound(f: F): FiniteField {
    return FiniteField.from(
      super.divRound(FiniteField.from(f, this.order)),
      this.order,
    )
  }

  or(f: F): FiniteField {
    return FiniteField.from(
      super.or(FiniteField.from(f, this.order)),
      this.order,
    )
  }

  ior(f: F): FiniteField {
    return FiniteField.from(
      super.ior(FiniteField.from(f, this.order)),
      this.order,
    )
  }

  uor(f: F): FiniteField {
    return FiniteField.from(
      super.uor(FiniteField.from(f, this.order)),
      this.order,
    )
  }

  iuor(f: F): FiniteField {
    return FiniteField.from(
      super.iuor(FiniteField.from(f, this.order)),
      this.order,
    )
  }

  and(f: F): FiniteField {
    return FiniteField.from(
      super.and(FiniteField.from(f, this.order)),
      this.order,
    )
  }

  iand(f: F): FiniteField {
    return FiniteField.from(
      super.iand(FiniteField.from(f, this.order)),
      this.order,
    )
  }

  uand(f: F): FiniteField {
    return FiniteField.from(
      super.uand(FiniteField.from(f, this.order)),
      this.order,
    )
  }

  iuand(f: F): FiniteField {
    return FiniteField.from(
      super.iuand(FiniteField.from(f, this.order)),
      this.order,
    )
  }

  andln(n: number): FiniteField {
    return FiniteField.from(super.andln(n), this.order)
  }

  xor(f: F): FiniteField {
    return FiniteField.from(
      super.xor(FiniteField.from(f, this.order)),
      this.order,
    )
  }

  ixor(f: F): FiniteField {
    return FiniteField.from(
      super.ixor(FiniteField.from(f, this.order)),
      this.order,
    )
  }

  uxor(f: F): FiniteField {
    return FiniteField.from(
      super.uxor(FiniteField.from(f, this.order)),
      this.order,
    )
  }

  iuxor(f: F): FiniteField {
    return FiniteField.from(
      super.iuxor(FiniteField.from(f, this.order)),
      this.order,
    )
  }

  setn(n: number): FiniteField {
    return FiniteField.from(super.setn(n), this.order)
  }

  shln(n: number): FiniteField {
    return FiniteField.from(super.shln(n), this.order)
  }

  ishln(n: number): FiniteField {
    return FiniteField.from(super.ishln(n), this.order)
  }

  ushln(n: number): FiniteField {
    return FiniteField.from(super.ushln(n), this.order)
  }

  iushln(n: number): FiniteField {
    return FiniteField.from(super.iushln(n), this.order)
  }

  shrn(n: number): FiniteField {
    return FiniteField.from(super.shrn(n), this.order)
  }

  ishrn(n: number): FiniteField {
    return FiniteField.from(super.ishrn(n), this.order)
  }

  ushrn(n: number): FiniteField {
    return FiniteField.from(super.ushrn(n), this.order)
  }

  iushrn(n: number): FiniteField {
    return FiniteField.from(super.iushrn(n), this.order)
  }

  maskn(n: number): FiniteField {
    return FiniteField.from(super.maskn(n), this.order)
  }

  imaskn(n: number): FiniteField {
    return FiniteField.from(super.imaskn(n), this.order)
  }

  bincn(n: number): FiniteField {
    return FiniteField.from(super.bincn(n), this.order)
  }

  notn(w: number): FiniteField {
    return FiniteField.from(super.notn(w), this.order)
  }

  inotn(w: number): FiniteField {
    return FiniteField.from(super.inotn(w), this.order)
  }

  gcd(f: F): FiniteField {
    return FiniteField.from(
      super.gcd(FiniteField.from(f, this.order)),
      this.order,
    )
  }
}
