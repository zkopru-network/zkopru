import { Field } from '@zkopru/babyjubjub'
import { ZkTx } from '@zkopru/transaction'
import { root, logger } from '@zkopru/utils'
import assert from 'assert'
import BN from 'bn.js'

export interface TxPoolInterface {
  pendingNum(): number
  addToTxPool(zkTx: ZkTx): Promise<void>
  pickTxs(maxBytes: number, minPricePerByte: BN): Promise<ZkTx[] | null>
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

  async pickTxs(maxBytes: number, minPricePerByte: BN): Promise<ZkTx[] | null> {
    // TODO add atomic swap tx logic here
    let available = maxBytes
    const sorted = this.getSortedTxs()
    const pending: (ZkTx[] | ZkTx)[] = []
    // Add pairing transactions first
    const swapTxs: { [txHash: string]: ZkTx } = {}
    sorted
      .filter(tx => tx.swap !== undefined)
      .forEach(tx => {
        swapTxs[tx.hash().toString()] = tx
      })
    while (Object.keys(swapTxs).length !== 0) {
      // Get Alice's transaction
      const alicesTxHash = Object.keys(swapTxs)[0]
      const alices = swapTxs[alicesTxHash]
      assert(alices.swap, 'Filtering has some problem.')
      const noteForAlice: Field = alices.swap
      // Remove Alice's from the pending list
      delete swapTxs[alicesTxHash]
      // Find Bob's tx from the remaining transactions which pairs with the Alice's
      const bobs = Object.values(swapTxs).find(tx => {
        assert(tx.swap, 'Filtering has some problem.')
        const noteForBob = tx.swap
        const okayForAlice = tx.outflow.find(o => o.note.eq(noteForAlice))
        const okayForBob = alices.outflow.find(o => o.note.eq(noteForBob))
        return okayForAlice && okayForBob
      })
      if (bobs) {
        // Found paired transaction. Add to the pending tx list as a paired form.
        delete swapTxs[bobs.hash().toString()]
        pending.push([alices, bobs])
      }
    }
    // Add single transactions to the pending list
    sorted
      .filter(tx => tx.swap === undefined)
      .forEach(tx => {
        pending.push(tx)
      })

    const picked: ZkTx[] = []
    let fee = Field.zero
    while (available > 0 && pending.length > 0) {
      const tx = pending.pop()
      if (!tx) break
      if (tx instanceof ZkTx) {
        // Normal transactions
        const size = tx.size()
        const expectedFee = minPricePerByte.muln(size)
        logger.info(`expected fee: ${expectedFee.toString()}`)
        logger.info(`tx.fee: ${tx.fee.toString()}`)
        if (available >= size && tx.fee.gte(expectedFee)) {
          available -= size
          fee = fee.add(tx.fee)
          picked.push(tx)
        }
      } else {
        // Paired transactions for atomic swap
        if (tx.length !== 2)
          throw Error('Swap transactions are not paired properly')
        const size = tx[0].size() + tx[1].size()
        const expectedFee = minPricePerByte.muln(size)
        const swapFee = tx[0].fee.add(tx[1].fee)
        logger.info(`expected fee: ${expectedFee.toString()}`)
        logger.info(`tx.fee: ${swapFee.toString()}`)
        if (available >= size && swapFee.gte(expectedFee)) {
          available -= size
          fee = fee.add(swapFee)
          picked.push(tx[0], tx[1])
        }
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
