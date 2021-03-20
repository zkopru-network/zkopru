import { poseidon } from 'circomlib'
import { Fp, Fr, Point } from '@zkopru/babyjubjub'
import { ZkAddress, ZkTx, Utxo, TokenRegistry } from '@zkopru/transaction'
import { soliditySha3Raw } from 'web3-utils'

export class ZkViewer {
  private A: Point // EdDSA Public Key

  private n: Fr // viewing key, nullifier seed

  zkAddress: ZkAddress // https://github.com/zkopru-network/zkopru/issues/43

  constructor(A: Point, n: Fr) {
    this.A = A
    this.n = n
    // Public viewing key, public nullifier seed
    const N = Point.BASE8.mul(n)
    // Public spending key
    const PubSK = Fp.from(
      poseidon([
        this.A.x.toBigInt(),
        this.A.y.toBigInt(),
        this.n.toBigInt(),
      ]).toString(),
    )
    this.zkAddress = ZkAddress.from(PubSK, N)
  }

  getEdDSAPubKey(): Point {
    return this.A
  }

  decrypt(zkTx: ZkTx, tokenRegistry?: TokenRegistry): Utxo | undefined {
    const { memo } = zkTx
    if (!memo) {
      return
    }
    let note: Utxo | undefined
    for (const outflow of zkTx.outflow) {
      try {
        note = Utxo.decrypt({
          utxoHash: outflow.note,
          memo,
          spendingPubKey: this.zkAddress.spendingPubKey(),
          viewingKey: this.n,
          tokenRegistry,
        })
      } catch (err) {
        console.error(err)
      }
      if (note) break
    }
    return note ? Utxo.from(note) : undefined
  }

  getNullifierSeed(): Fp {
    return this.n
  }

  encodeViewingKey(): string {
    const concatenated = Buffer.concat([
      this.A.x.toBytes32().toBuffer(),
      this.A.y.toBytes32().toBuffer(),
      this.n.toBytes32().toBuffer(),
      Buffer.from(soliditySha3Raw(this.zkAddress.toString()).slice(-8), 'hex'),
    ])
    return concatenated.toString('hex')
  }

  static from(encoded: string): ZkViewer {
    const buff = Buffer.from(encoded, 'hex')
    const Ax = Fp.from(buff.slice(0, 32))
    const Ay = Fp.from(buff.slice(32, 64))
    const n = Fr.from(buff.slice(64, 92))
    const addressHash = buff.slice(92, 96)
    const A = Point.from(Ax, Ay)
    const viewer = new ZkViewer(A, n)
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
