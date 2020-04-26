import { Field } from '@zkopru/babyjubjub'
import { ZkTx } from '@zkopru/transaction'
import { root } from '@zkopru/utils'
import { Hex } from 'web3-utils'

export interface TxPoolInterface {
  pendingNum(): number
  addToTxPool(zkTx: ZkTx): Promise<void>
  pickTxs(
    maxBytes: number,
    minProposalCost: number,
    minPricePerByte: Field,
  ): Promise<ZkTx[] | null>
  markAsIncluded(txs: ZkTx[]): void
}

export class TxMemPool implements TxPoolInterface {
  queued: {
    [includedIn: string]: ZkTx[]
  }

  txs: {
    [proposalHash: string]: ZkTx
  }

  constructor() {
    this.txs = {}
    this.queued = {}
  }

  pendingNum(): number {
    return Object.keys(this.txs).length
  }

  async addToTxPool(zkTx: ZkTx): Promise<void> {
    const txHash = zkTx.hash()
    this.txs[txHash] = zkTx
  }

  async pickTxs(
    maxBytes: number,
    minProposalCost: number,
    minPricePerByte: Field,
  ): Promise<ZkTx[] | null> {
    // TODO add atomic swap tx logic here
    let available = maxBytes
    const pending = this.getSortedTxs()
    const picked: ZkTx[] = []
    let fee = Field.zero
    while (available > 0 && pending.length > 0) {
      const tx = pending.pop()
      if (!tx) break
      const size = tx.size()
      const expectedFee = minPricePerByte.muln(size)
      if (available >= size && tx.fee.gte(expectedFee)) {
        available -= size
        fee = fee.add(tx.fee)
        picked.push(tx)
      }
    }
    if (fee.ltn(minProposalCost)) return null
    return picked
  }

  markAsIncluded(txs: ZkTx[]) {
    const txRoot = root(txs.map(tx => tx.hash()))
    this.queued[txRoot] = txs
    this.removeFromTxPool(txs)
  }

  drop(txRoot: Hex) {
    delete this.queued[txRoot]
  }

  revert(txRoot: Hex) {
    const txs = this.queued[txRoot]
    if (txs) {
      txs.forEach(this.addToTxPool)
    }
    delete this.queued[txRoot]
  }

  private removeFromTxPool(txs: ZkTx[]) {
    for (const tx of txs) {
      delete this.txs[tx.hash()]
    }
  }

  private getSortedTxs(): ZkTx[] {
    return Object.values(this.txs).sort((a, b) => (a.fee.gt(b.fee) ? 1 : -1))
  }
}
