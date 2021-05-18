import { Fp } from '@zkopru/babyjubjub'
import { ZkTx } from '@zkopru/transaction'
import { DB } from '@zkopru/database'
import { root, logger } from '@zkopru/utils'
import assert from 'assert'
import BN from 'bn.js'

export interface TxPoolInterface {
  pendingNum(): number
  addToTxPool(zkTx: ZkTx): Promise<void>
  pickTxs(maxBytes: number, minPricePerByte: BN): Promise<ZkTx[]>
  markAsIncluded(txs: ZkTx[]): void
  pendingTxs(): ZkTx[]
  drop(txRoot: string): void
  revert(txRoot: string): void
  loadPendingTx(): Promise<void>
}

export class TxMemPool implements TxPoolInterface {
  queued: {
    [includedIn: string]: ZkTx[]
  }

  txs: {
    [proposalTx: string]: ZkTx
  }

  db: DB

  constructor(db: DB) {
    this.txs = {}
    this.queued = {}
    this.db = db
  }

  // Look for transactions that have been included in a verified block
  private async verifiedTx(hashes: string[]): Promise<string[]> {
    const includedTxs = await this.db.findMany('Tx', {
      where: {
        hash: hashes,
      },
    })
    // check if the tx is in a valid block, if so delete it from PendingTx
    const blocks = await this.db.findMany('Block', {
      where: {
        hash: includedTxs.map(({ blockHash }) => blockHash),
      },
    })
    const blocksByHash = blocks.reduce(
      (acc, block) => ({
        ...acc,
        [block.hash]: block,
      }),
      {},
    )
    const hashesToDrop = [] as string[]
    for (const tx of includedTxs) {
      if (
        !tx.challenged &&
        !tx.slashed &&
        blocksByHash[tx.blockHash] &&
        blocksByHash[tx.blockHash].verified
      ) {
        // if the tx is not challenged and we've locally verified the block it's
        // included in we can drop the pending tx
        hashesToDrop.push(tx.hash)
      }
    }
    return hashesToDrop
  }

  async loadPendingTx() {
    const txs = await this.db.findMany('PendingTx', {
      where: {},
    })
    // Look for pending transactions that have since been included in a block
    const hashesToDrop = await this.verifiedTx(txs.map(({ hash }) => hash))
    if (hashesToDrop.length > 0) {
      await this.db.delete('PendingTx', {
        where: {
          hash: hashesToDrop,
        },
      })
    }
    for (const tx of txs) {
      // Parse the tx from the db
      // eslint-disable-next-line no-continue
      if (hashesToDrop[tx.hash]) continue
      // unwrap the ZkTx from the db entry
      /* eslint-disable @typescript-eslint/camelcase */
      const zktx = new ZkTx({
        inflow: tx.inflow.map(({ nullifier, root }) => ({
          nullifier: Fp.from(nullifier),
          root: Fp.from(root),
        })),
        outflow: tx.outflow.map(({ note, outflowType, data }) => ({
          note: Fp.from(note),
          outflowType: Fp.from(outflowType),
          data: data ? Fp.from(data) : undefined,
        })),
        fee: Fp.from(tx.fee),
        proof: {
          pi_a: tx.proof.pi_a.map((v: string) => Fp.from(v)),
          pi_b: tx.proof.pi_b.map((a: string[]) =>
            a.map((v: string) => Fp.from(v)),
          ),
          pi_c: tx.proof.pi_c.map((v: string) => Fp.from(v)),
        },
        swap: tx.swap ? Fp.from(tx.swap) : undefined,
        memo: tx.memo ? Buffer.from(tx.memo, 'base64') : undefined,
      })
      /* eslint-enable @typescript-eslint/camelcase */
      this.txs[zktx.hash().toString()] = zktx
    }
  }

  async storePendingTx(tx: ZkTx) {
    await this.db.upsert('PendingTx', {
      where: {
        hash: tx.hash().toString(),
      },
      update: {},
      create: {
        hash: tx.hash().toString(),
        fee: tx.fee.toString(),
        proof: tx.proof,
        memo: tx.memo?.toString('base64'),
        swap: tx.swap?.toString(),
        inflow: tx.inflow,
        outflow: tx.outflow,
      },
    })
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
    await this.storePendingTx(zkTx)
  }

  private async prunePendingTx() {
    const txHashes = Object.keys(this.txs)
    const hashesToDrop = await this.verifiedTx(txHashes)
    for (const hash of hashesToDrop) {
      delete this.txs[hash]
    }
  }

  async pickTxs(maxBytes: number, minPricePerByte: BN): Promise<ZkTx[]> {
    await this.prunePendingTx()
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
      const noteForAlice: Fp = alices.swap
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
    let fee = Fp.zero
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
      txs.forEach(this.addToTxPool.bind(this))
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
