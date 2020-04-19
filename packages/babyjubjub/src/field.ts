import BN from 'bn.js'
import bigInt, { BigInteger } from 'big-integer'

export type F = number | string | number[] | Uint8Array | Buffer | BN

const r = new BN(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617',
)
export class Field extends BN {
  constructor(
    number: number | string | number[] | Uint8Array | Buffer | BN,
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
    if (super.gte(r)) {
      return Field.from(super.sub(r))
    }
    if (super.isNeg()) {
      return Field.from(super.add(r))
    }
  }

  static zero = Field.from(0)

  static one = Field.from(1)

  static from(x: F): Field {
    if (x === undefined) return new Field(0)
    if (x instanceof Field) {
      return x
    }
    return new Field(x)
  }

  static toBN(x: F): BN {
    if (typeof x === 'string' && x.startsWith('0x')) {
      return new BN(x.substr(2), 16)
    }
    return new BN(x)
  }

  static fromBuffer(buff: Buffer): Field {
    return Field.from(`0x${buff.toString('hex')}`)
  }

  addPrefixBit(bitLength: number): BN {
    const prefix = new BN(1).shln(bitLength)
    if (this.gt(prefix)) throw Error('prefix bit is less than current value')
    return prefix.or(this)
  }

  toHex(byteLength?: number): string {
    if (byteLength) {
      return `0x${this.toBuffer('be', byteLength).toString('hex')}`
    }
    return `0x${this.toString('hex')}`
  }

  toIden3BigInt(): BigInteger {
    return bigInt(this.toString())
  }

  toTwos(width: number): Field {
    return Field.from(super.toTwos(width))
  }

  fromTwos(width: number): Field {
    return Field.from(super.fromTwos(width))
  }

  neg(): Field {
    return Field.from(super.neg())
  }

  ineg(): Field {
    return Field.from(super.ineg())
  }

  abs(): Field {
    return Field.from(super.abs())
  }

  iabs(): Field {
    return Field.from(super.iabs())
  }

  add(f: F): Field {
    return Field.from(super.add(Field.from(f)))
  }

  iadd(f: F): Field {
    return Field.from(super.iadd(Field.from(f)))
  }

  addn(n: number): Field {
    return Field.from(super.addn(n))
  }

  iaddn(n: number): Field {
    return Field.from(super.iaddn(n))
  }

  sub(f: F): Field {
    return Field.from(super.sub(Field.from(f)))
  }

  isub(f: F): Field {
    return Field.from(super.isub(Field.from(f)))
  }

  subn(n: number): Field {
    return Field.from(super.subn(n))
  }

  isubn(n: number): Field {
    return Field.from(super.isubn(n))
  }

  mul(f: F): Field {
    return Field.from(super.mul(Field.from(f)))
  }

  imul(f: F): Field {
    return Field.from(super.imul(Field.from(f)))
  }

  muln(n: number): Field {
    return Field.from(super.muln(n))
  }

  imuln(n: number): Field {
    return Field.from(super.imuln(n))
  }

  sqr(): Field {
    return Field.from(super.sqr())
  }

  isqr(): Field {
    return Field.from(super.isqr())
  }

  pow(f: F): Field {
    return Field.from(super.pow(Field.from(f)))
  }

  div(f: F): Field {
    return Field.from(super.div(Field.from(f)))
  }

  divn(n: number): Field {
    return Field.from(super.divn(n))
  }

  mod(f: F): Field {
    return Field.from(super.mod(Field.from(f)))
  }

  umod(f: F): Field {
    return Field.from(super.umod(Field.from(f)))
  }

  divRound(f: F): Field {
    return Field.from(super.divRound(Field.from(f)))
  }

  or(f: F): Field {
    return Field.from(super.or(Field.from(f)))
  }

  ior(f: F): Field {
    return Field.from(super.ior(Field.from(f)))
  }

  uor(f: F): Field {
    return Field.from(super.uor(Field.from(f)))
  }

  iuor(f: F): Field {
    return Field.from(super.iuor(Field.from(f)))
  }

  and(f: F): Field {
    return Field.from(super.and(Field.from(f)))
  }

  iand(f: F): Field {
    return Field.from(super.iand(Field.from(f)))
  }

  uand(f: F): Field {
    return Field.from(super.uand(Field.from(f)))
  }

  iuand(f: F): Field {
    return Field.from(super.iuand(Field.from(f)))
  }

  andln(n: number): Field {
    return Field.from(super.andln(n))
  }

  xor(f: F): Field {
    return Field.from(super.xor(Field.from(f)))
  }

  ixor(f: F): Field {
    return Field.from(super.ixor(Field.from(f)))
  }

  uxor(f: F): Field {
    return Field.from(super.uxor(Field.from(f)))
  }

  iuxor(f: F): Field {
    return Field.from(super.iuxor(Field.from(f)))
  }

  setn(n: number): Field {
    return Field.from(super.setn(n))
  }

  shln(n: number): Field {
    return Field.from(super.shln(n))
  }

  ishln(n: number): Field {
    return Field.from(super.ishln(n))
  }

  ushln(n: number): Field {
    return Field.from(super.ushln(n))
  }

  iushln(n: number): Field {
    return Field.from(super.iushln(n))
  }

  shrn(n: number): Field {
    return Field.from(super.shrn(n))
  }

  ishrn(n: number): Field {
    return Field.from(super.ishrn(n))
  }

  ushrn(n: number): Field {
    return Field.from(super.ushrn(n))
  }

  iushrn(n: number): Field {
    return Field.from(super.iushrn(n))
  }

  maskn(n: number): Field {
    return Field.from(super.maskn(n))
  }

  imaskn(n: number): Field {
    return Field.from(super.imaskn(n))
  }

  bincn(n: number): Field {
    return Field.from(super.bincn(n))
  }

  notn(w: number): Field {
    return Field.from(super.notn(w))
  }

  inotn(w: number): Field {
    return Field.from(super.inotn(w))
  }

  gcd(f: F): Field {
    return Field.from(super.gcd(Field.from(f)))
  }
}
