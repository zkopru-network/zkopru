import bigInt, { BigNumber, BigInteger } from 'big-integer'
import { padLeft } from 'web3-utils'

export type F = BigNumber | Field

const r = bigInt(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617',
)
export class Field {
  val: BigInteger

  constructor(val: BigNumber) {
    if (typeof val === 'number') {
      this.val = bigInt(val)
    } else if (typeof val === 'string') {
      this.val = bigInt(val)
    } else if (typeof val === 'bigint') {
      this.val = bigInt(val)
    } else {
      this.val = val
    }
    if (this.val >= r) {
      throw Error(`Exceeds SNARK field: ${this.val.toString()}`)
    }
  }

  static zero = Field.from(bigInt(0))

  static from(x: F): Field {
    if (x === undefined) return new Field(bigInt(0))
    if (x instanceof Field) {
      return x
    }
    return new Field(x)
  }

  static fromBuffer(buff: Buffer): Field {
    return Field.from(`0x${buff.toString('hex')}`)
  }

  toBuffer(n?: number): Buffer {
    if (n && !this.val.shiftRight(n * 8).isZero()) {
      throw Error('Not enough buffer size')
    }
    const hex = n
      ? padLeft(this.val.toString(16), 2 * n)
      : this.val.toString(16)
    return Buffer.from(hex, 'hex')
  }

  toNumber(): number {
    return parseInt(this.toHex(), 16)
  }

  shl(n: F): Field {
    if (n instanceof Field) return Field.from(this.val.shiftLeft(n.val))
    return Field.from(this.val.shiftLeft(n))
  }

  shr(n: F): Field {
    if (n instanceof Field) return Field.from(this.val.shiftRight(n.val))
    return Field.from(this.val.shiftRight(n))
  }

  isZero(): boolean {
    return this.val.isZero()
  }

  toString(radix = 10): string {
    return this.val.toString(radix)
  }

  toHex(): string {
    return `0x${this.val.toString(16)}`
  }

  equal(n: F): boolean {
    return Field.from(n).equal(this)
  }

  add(n: F): Field {
    let newVal: BigInteger
    if (n instanceof Field) {
      newVal = this.val.add(n.val)
    } else {
      newVal = this.val.add(n)
    }
    if (newVal < this.val) {
      throw Error('Field overflow')
    }
    return Field.from(newVal)
  }

  sub(n: F): Field {
    let newVal: BigInteger
    if (n instanceof Field) {
      newVal = this.val.subtract(n.val)
    } else {
      newVal = this.val.subtract(n)
    }
    if (newVal > this.val) {
      throw Error('Field underflow')
    }
    return Field.from(newVal)
  }

  mul(n: F): Field {
    let newVal: BigInteger
    if (n instanceof Field) {
      newVal = this.val.multiply(n.val)
    } else {
      newVal = this.val.multiply(n)
    }
    return Field.from(newVal)
  }

  gt(n: F): boolean {
    if (n instanceof Field) {
      return this.val.greater(n.val)
    }
    return this.gt(Field.from(n))
  }

  gte(n: F): boolean {
    if (n instanceof Field) {
      return this.val.greaterOrEquals(n.val)
    }
    return this.gte(Field.from(n))
  }

  lt(n: F): boolean {
    if (n instanceof Field) {
      return this.val.lesser(n.val)
    }
    return this.lt(Field.from(n))
  }

  lte(n: F): boolean {
    if (n instanceof Field) {
      return this.val.lesserOrEquals(n.val)
    }
    return this.lte(Field.from(n))
  }
}
