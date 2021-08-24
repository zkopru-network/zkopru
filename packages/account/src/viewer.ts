import { poseidon } from 'circomlib'
import { Fp, Fr, Point } from '@zkopru/babyjubjub'
import {
  ZkAddress,
  ZkTx,
  Utxo,
  TokenRegistry,
  MemoVersion,
  V2_MEMO_DEFAULT_ABI,
  V2_MEMO_WITHDRAW_SIG_ABI,
  ZkOutflow,
} from '@zkopru/transaction'
import { Bytes4 } from 'soltypes'
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
    const decodeNote = (bytes: Buffer, outflows: ZkOutflow[]): Utxo | void => {
      if (bytes.length !== 81) {
        throw new Error('Expected a single encrypted note with 81 bytes')
      }
      for (const outflow of outflows) {
        try {
          return Utxo.decrypt({
            utxoHash: outflow.note,
            memo: bytes,
            spendingPubKey: this.zkAddress.spendingPubKey(),
            viewingKey: this.v,
            tokenRegistry,
          })
        } catch (err) {
          console.error(err)
        }
      }
    }
    const { memo } = zkTx
    if (!memo) return []
    if (memo.version === MemoVersion.V1) {
      const note = decodeNote(memo.data, zkTx.outflow)
      return note ? [note] : []
    }
    if (memo.version === MemoVersion.V2) {
      const notes: Utxo[] = []
      const sig = memo.data.slice(0, 4)
      const memoSig = Bytes4.from(`0x${sig.toString('hex')}`)
      let noteData: Buffer
      const memoData = `0x${memo.data.toString('hex').slice(8)}`
      if (V2_MEMO_DEFAULT_ABI.eq(memoSig)) {
        noteData = Buffer.from(memoData.replace('0x', ''), 'hex')
      } else if (V2_MEMO_WITHDRAW_SIG_ABI.eq(memoSig)) {
        // Assume the first field is the prepay sig
        // 1 byte padding
        // 32 bytes eth prepay fee
        // 32 bytes token prepay fee
        // 8 byte expiration date (seconds)
        // 8 bytes length of signature sections (number of 81 byte sections following)
        // after the final signature section there will possibly be utxo notes to decode
        throw new Error('Withdraw sig parsing not implemented')
      } else {
        throw new Error(`Unrecognized memo signature: ${memoSig}`)
      }
      if (noteData.length % 81 !== 0) throw Error('Invalid memo field')
      const num = noteData.length / 81
      for (let i = 0; i < num; i += 1) {
        const encrypted = noteData.slice(i * 81, (i + 1) * 81)
        const note = decodeNote(encrypted, zkTx.outflow)
        if (note) notes.push(note)
      }
      return notes
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
