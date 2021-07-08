import { poseidon } from 'circomlib'
import { Fp, Fr, Point } from '@zkopru/babyjubjub'
import {
  ZkAddress,
  ZkTx,
  Utxo,
  TokenRegistry,
  MemoVersion,
  V2_MEMO_DEFAULT_ABI,
} from '@zkopru/transaction'
import { Bytes4 } from 'soltypes'
import { soliditySha3Raw } from 'web3-utils'
import { logger } from '@zkopru/utils'

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
    const { memo } = zkTx
    if (!memo) return []
    if (memo.version === MemoVersion.V1) {
      let note: Utxo | undefined
      for (const outflow of zkTx.outflow) {
        try {
          note = Utxo.decrypt({
            utxoHash: outflow.note,
            memo: memo.data,
            spendingPubKey: this.zkAddress.spendingPubKey(),
            viewingKey: this.v,
            tokenRegistry,
          })
        } catch (err) {
          console.error(err)
        }
        if (note) break
      }
      return note ? [Utxo.from(note)] : []
    }
    if (memo.version === MemoVersion.V2) {
      const notes: Utxo[] = []
      const sig = memo.data.slice(0, 4)
      if (V2_MEMO_DEFAULT_ABI.eq(Bytes4.from(`0x${sig.toString('hex')}`))) {
        const data = memo.data.slice(4)
        if (data.length % 81 !== 0) throw Error('Invalid memo field')
        const num = data.length / 81
        for (let i = 0; i < num; i += 1) {
          const encrypted = data.slice(i * 81, (i + 1) * 81)
          let note: Utxo | undefined
          for (const outflow of zkTx.outflow) {
            try {
              note = Utxo.decrypt({
                utxoHash: outflow.note,
                memo: encrypted,
                spendingPubKey: this.zkAddress.spendingPubKey(),
                viewingKey: this.v,
                tokenRegistry,
              })
            } catch (err) {
              console.error(err)
            }
            if (note) break
          }
          if (note) notes.push(note)
        }
        return notes
      }
      logger.warn('Unknown ABI')
      throw Error('Invalid memo field')

      // if (memo.data.length === )
      // const memos = memo.data.slice()
    }
    return []
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
