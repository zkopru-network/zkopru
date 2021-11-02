import { Fp, Point } from '@zkopru/babyjubjub'
import base58 from 'bs58'
import createKeccak from 'keccak'
import assert from 'assert'

export class ZkAddress {
  private PubSK: Fp // public spending key = poseidon(Ax, Ay, n)

  private N: Point // public viewing key = nB where n is the nullifier seed and also the viewing key

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
    this.PubSK = new Fp(decoded.slice(0, 32), undefined, 'le')
    this.N = Point.decode(decoded.slice(32, 64))
    this.address = addr
  }

  spendingPubKey(): Fp {
    return this.PubSK
  }

  viewingPubKey(): Point {
    return this.N
  }

  toString(): string {
    return this.address
  }

  toBuffer(): Buffer {
    return base58.decode(this.address)
  }

  eq(addr: ZkAddress): boolean {
    return this.toString() === addr.toString()
  }

  static fromBuffer(data: Buffer): ZkAddress {
    return new ZkAddress(base58.encode(data))
  }

  static from(PubSK: Fp, N: Point): ZkAddress {
    const payload = Buffer.concat([PubSK.toBuffer('le', 32), N.encode()])
    assert(payload.length === 64)
    const checksum = createKeccak('keccak256')
      .update(payload)
      .digest()
      .slice(0, 4)

    const address = base58.encode(Buffer.concat([payload, checksum]))
    return new ZkAddress(address)
  }

  static null = ZkAddress.from(Fp.zero, Point.zero)
}
