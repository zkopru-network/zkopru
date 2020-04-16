import { Field } from '@zkopru/babyjubjub'
import { ZkTx } from '@zkopru/transaction'

export interface TxPoolInterface {
  pendingNum(): number
  addToTxPool(zkTx: ZkTx): Promise<void>
  pickTxs(maxBytes: number, minFee: Field): Promise<ZkTx[] | null>
  removeFromTxPool(txs: ZkTx[]): void
}

export class TxMemPool implements TxPoolInterface {
  // blockTxMap: {
  //   [includedIn: string]: Hex[]
  // }

  txs: {
    [proposalHash: string]: ZkTx
  }

  // candidateTxRoots: string[]

  // verifyingKeys: { [key: string]: {} }

  constructor() {
    // this.pool = []
    // this.blockTxMap = {
    // [PENDING]: [],
    // }
    this.txs = {}
  }

  pendingNum(): number {
    return Object.keys(this.txs).length
  }

  async addToTxPool(zkTx: ZkTx): Promise<void> {
    const txHash = zkTx.hash()
    this.txs[txHash] = zkTx
  }

  async pickTxs(maxBytes: number, minFee: Field): Promise<ZkTx[] | null> {
    // TODO add atomic swap tx logic here
    let available = maxBytes
    const pending = this.getSortedTxs()
    const picked: ZkTx[] = []
    let fee = Field.zero
    while (available > 0 && pending.length > 0) {
      const tx = pending.pop()
      if (!tx) break
      const size = tx.size()
      if (available >= size) {
        available -= size
        fee = fee.add(tx.fee)
        picked.push(tx)
      }
    }
    if (fee.lt(minFee)) return null
    return picked
  }

  removeFromTxPool(txs: ZkTx[]) {
    for (const tx of txs) {
      delete this.txs[tx.hash()]
    }
  }

  private getSortedTxs(): ZkTx[] {
    return Object.values(this.txs).sort((a, b) => (a.fee.gt(b.fee) ? 1 : -1))
  }
}
