import { Field, Point } from '@zkopru/babyjubjub'
import base58 from 'bs58'
import createKeccak from 'keccak'
import assert from 'assert'

export class ZkAddress {
  private P: Field

  private N: Point

  private address: string

  constructor(addr: string) {
    const decoded = base58.decode(addr)
    if (decoded.length !== 68)
      throw Error('Invalid address data. It should have 68 bytes')
    const checksum = createKeccak('keccak256')
      .update(decoded.slice(0, 64))
      .digest()
      .slice(0, 4)
    if (!checksum.equals(decoded.slice(64)))
      throw Error('Checksum does not match')
    this.P = Field.fromBuffer(decoded.slice(0, 32))
    this.N = Point.decode(decoded.slice(32, 64))
    this.address = addr
  }

  spendingPubKey(): Field {
    return this.P
  }

  viewingPubKey(): Point {
    return this.N
  }

  toString(): string {
    return this.address
  }

  eq(addr: ZkAddress): boolean {
    return this.toString() === addr.toString()
  }

  static from(P: Field, N: Point): ZkAddress {
    const to32BytesBuffer = (data: Buffer): Buffer => {
      const buff = Buffer.alloc(32)
      data.copy(buff, buff.length - data.length)
      return buff
    }
    const payload = Buffer.concat(
      [P.toBytes32().toBuffer(), N.encode()].map(to32BytesBuffer),
    )
    assert(payload.length === 64)
    const checksum = createKeccak('keccak256')
      .update(payload)
      .digest()
      .slice(0, 4)

    const address = base58.encode(Buffer.concat([payload, checksum]))
    return new ZkAddress(address)
  }

  static null = ZkAddress.from(Field.zero, Point.zero)
}
