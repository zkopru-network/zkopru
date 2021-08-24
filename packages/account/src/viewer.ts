import { poseidon } from 'circomlib'
import { Fp, Fr, Point } from '@zkopru/babyjubjub'
import {
  ZkAddress,
  ZkTx,
  Utxo,
  TokenRegistry,
  ZkOutflow,
} from '@zkopru/transaction'
import { soliditySha3Raw } from 'web3-utils'

export class ZkViewer {
  private A: Point // EdDSA Public Key

  private v: Fr // viewing key, nullifier seed

  zkAddress: ZkAddress // https://github.com/zkopru-network/zkopru/issues/43

  constructor(A: Point, v: Fr) {
    this.A = A
    this.v = v
    // Public viewing key, public nullifier seed
    const V = Point.BASE8.mul(v)
    // Public spending key
    const PubSK = Fp.from(
      poseidon([
        this.A.x.toBigInt(),
        this.A.y.toBigInt(),
        this.v.toBigInt(),
      ]).toString(),
    )
    this.zkAddress = ZkAddress.from(PubSK, V)
  }

  getEdDSAPubKey(): Point {
    return this.A
  }

  decrypt(zkTx: ZkTx, tokenRegistry?: TokenRegistry): Utxo[] {
    const tryDecodeNote = (
      bytes: Buffer,
      outflows: ZkOutflow[],
    ): Utxo | void => {
      if (bytes.length !== 81) {
        throw new Error('Expected a single encrypted note with 81 bytes')
      }
      for (const outflow of outflows) {
        try {
          const note = Utxo.decrypt({
            utxoHash: outflow.note,
            memo: bytes,
            spendingPubKey: this.zkAddress.spendingPubKey(),
            viewingKey: this.v,
            tokenRegistry,
          })
          if (note) return note
        } catch (err) {
          // console.error(err)
        }
      }
    }
    const { encryptedNotes } = zkTx.parseMemo()
    const notes = [] as Utxo[]
    for (const encrypted of encryptedNotes) {
      const note = tryDecodeNote(encrypted, zkTx.outflow)
      if (note) notes.push(note)
    }
    return notes
  }

  getNullifierSeed(): Fp {
    return this.v
  }

  encodeViewingKey(): string {
    const concatenated = Buffer.concat([
      this.A.x.toBytes32().toBuffer(),
      this.A.y.toBytes32().toBuffer(),
      this.v.toBytes32().toBuffer(),
      Buffer.from(soliditySha3Raw(this.zkAddress.toString()).slice(-8), 'hex'),
    ])
    return concatenated.toString('hex')
  }

  static from(encoded: string): ZkViewer {
    const buff = Buffer.from(encoded, 'hex')
    const Ax = Fp.from(buff.slice(0, 32))
    const Ay = Fp.from(buff.slice(32, 64))
    const v = Fr.from(buff.slice(64, 92))
    const addressHash = buff.slice(92, 96)
    const A = Point.from(Ax, Ay)
    const viewer = new ZkViewer(A, v)
    const success = addressHash.equals(
      Buffer.from(
        soliditySha3Raw(viewer.zkAddress.toString()).slice(-8),
        'hex',
      ),
    )
    if (!success) {
      throw Error(
        'Invalid encoding. The last 4 bytes should be the hash of the retrieved address',
      )
    }
    return viewer
  }
}
