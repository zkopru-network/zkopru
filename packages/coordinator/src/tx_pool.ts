import { Field } from '@zkopru/babyjubjub'
import { ZkTx } from '@zkopru/transaction'
import { root, logger } from '@zkopru/utils'

export interface TxPoolInterface {
  pendingNum(): number
  addToTxPool(zkTx: ZkTx): Promise<void>
  pickTxs(maxBytes: number, minPricePerByte: Field): Promise<ZkTx[] | null>
  markAsIncluded(txs: ZkTx[]): void
  pendingTxs(): ZkTx[]
}

export class TxMemPool implements TxPoolInterface {
  queued: {
    [includedIn: string]: ZkTx[]
  }

  txs: {
    [proposalTx: string]: ZkTx
  }

  constructor() {
    this.txs = {}
    this.queued = {}
  }

  pendingNum(): number {
    return Object.keys(this.txs).length
  }

  pendingTxs(): ZkTx[] {
    return Object.values(this.txs)
  }

  async addToTxPool(zkTx: ZkTx): Promise<void> {
    const txHash = zkTx.hash()
    this.txs[txHash.toString()] = zkTx
  }

  async pickTxs(
    maxBytes: number,
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
      logger.info(`expected fee: ${expectedFee.toString()}`)
      logger.info(`tx.fee: ${tx.fee.toString()}`)
      if (available >= size && tx.fee.gte(expectedFee)) {
        available -= size
        fee = fee.add(tx.fee)
        picked.push(tx)
      }
    }
    logger.info(`fee: ${fee}`)
    return picked
  }

  markAsIncluded(txs: ZkTx[]) {
    const txRoot = root(txs.map(tx => tx.hash()))
    this.queued[txRoot.toString()] = txs
    this.removeFromTxPool(txs)
  }

  drop(txRoot: string) {
    delete this.queued[txRoot]
  }

  revert(txRoot: string) {
    const txs = this.queued[txRoot]
    if (txs) {
      txs.forEach(this.addToTxPool)
    }
    delete this.queued[txRoot]
  }

  private removeFromTxPool(txs: ZkTx[]) {
    for (const tx of txs) {
      delete this.txs[tx.hash().toString()]
    }
  }

  private getSortedTxs(): ZkTx[] {
    return Object.values(this.txs).sort((a, b) => (a.fee.gt(b.fee) ? 1 : -1))
  }
}
