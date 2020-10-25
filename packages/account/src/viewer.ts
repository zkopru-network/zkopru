import { poseidon } from 'circomlib'
import { Field, Point } from '@zkopru/babyjubjub'
import { ZkAddress, ZkTx, Utxo, TokenRegistry } from '@zkopru/transaction'
import { soliditySha3Raw } from 'web3-utils'

export class ZkViewer {
  private pG: Point // spending key's EdDSA point

  private n: Field // nullifier seed, viewing key

  zkAddress: ZkAddress // https://github.com/zkopru-network/zkopru/issues/43

  constructor(pG: Point, n: Field) {
    this.pG = pG
    this.n = n
    const N = Point.fromPrivKey(this.n.toHex(32))
    const P = Field.from(
      poseidon([
        this.pG.x.toBigInt(),
        this.pG.y.toBigInt(),
        this.n.toBigInt(),
      ]).toString(),
    )
    this.zkAddress = ZkAddress.from(P, N)
  }

  getEdDSAPoint(): Point {
    return this.pG
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

  getNullifierSeed(): Field {
    return this.n
  }

  encodeViewingKey(): string {
    const concatenated = Buffer.concat([
      this.pG.x.toBytes32().toBuffer(),
      this.pG.y.toBytes32().toBuffer(),
      this.n.toBytes32().toBuffer(),
      Buffer.from(soliditySha3Raw(this.zkAddress.toString()).slice(-8), 'hex'),
    ])
    return concatenated.toString('hex')
  }

  static from(encoded: string): ZkViewer {
    const buff = Buffer.from(encoded, 'hex')
    const pGx = Field.from(buff.slice(0, 32))
    const pGy = Field.from(buff.slice(32, 64))
    const n = Field.from(buff.slice(64, 92))
    const addressHash = buff.slice(92, 96)
    const pG = Point.from(pGx, pGy)
    const viewer = new ZkViewer(pG, n)
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
