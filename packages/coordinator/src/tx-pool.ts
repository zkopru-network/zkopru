import { Fp } from '@zkopru/babyjubjub'
import { ZkTx } from '@zkopru/transaction'
import { DB, Header as HeaderSql } from '@zkopru/database'
import { root, logger } from '@zkopru/utils'
import assert from 'assert'
import { L2Chain, OffchainTxValidator } from '@zkopru/core'
import { Bytes32, Uint256 } from 'soltypes'
import { BigNumber } from 'ethers'

export interface TxPoolInterface {
  pendingNum(): number
  addToTxPool(zkTx: ZkTx | ZkTx[]): Promise<void>
  pickTxs(maxBytes: number, minPricePerByte: BigNumber): Promise<ZkTx[]>
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

  layer2: L2Chain

  txValidator: OffchainTxValidator

  latest?: Bytes32

  constructor(db: DB, layer2: L2Chain) {
    this.txs = {}
    this.queued = {}
    this.db = db
    this.layer2 = layer2
    this.txValidator = new OffchainTxValidator(layer2)
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
          data: data
            ? {
                to: Fp.from(data.to),
                eth: Fp.from(data.eth),
                tokenAddr: Fp.from(data.tokenAddr),
                erc20Amount: Fp.from(data.erc20Amount),
                nft: Fp.from(data.nft),
                fee: Fp.from(data.fee),
              }
            : undefined,
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
        memo: tx.memo
          ? {
              version: tx.memo.version,
              data: Buffer.from(tx.memo.data, 'base64'),
            }
          : undefined,
      })
      /* eslint-enable @typescript-eslint/camelcase */
      this.txs[zktx.hash().toString()] = zktx
    }
  }

  async storePendingTx(txs: ZkTx | ZkTx[]) {
    logger.trace('coordinator/tx-pool.ts - TxMemPool::storePendingTx()')
    await this.db.transaction(db => {
      for (const tx of [txs].flat()) {
        db.upsert('PendingTx', {
          where: {
            hash: tx.hash().toString(),
          },
          update: {},
          create: {
            hash: tx.hash().toString(),
            fee: tx.fee.toString(),
            proof: tx.proof,
            memoVersion: tx.memo?.version,
            memoData: tx.memo?.data.toString('base64'),
            swap: tx.swap?.toString(),
            inflow: tx.inflow,
            outflow: tx.outflow,
          },
        })
      }
    })
  }

  pendingNum(): number {
    return Object.keys(this.txs).length
  }

  pendingTxs(): ZkTx[] {
    return Object.values(this.txs)
  }

  async addToTxPool(txs: ZkTx | ZkTx[]): Promise<void> {
    for (const tx of [txs].flat()) {
      const txHash = tx.hash()
      this.txs[txHash.toString()] = tx
    }
    await this.storePendingTx(txs)
  }

  private async prunePendingTx() {
    const txHashes = Object.keys(this.txs)
    const hashesToDrop = await this.verifiedTx(txHashes)
    for (const hash of hashesToDrop) {
      delete this.txs[hash]
    }
    const hashesToRemove = [] as string[]
    for (const txHash of Object.keys(this.txs)) {
      const tx = this.txs[txHash]
      const hasValidRef = await this.hasValidRef(tx)
      if (!hasValidRef) hashesToRemove.push(txHash)
    }
    for (const hash of hashesToRemove) {
      delete this.txs[hash]
    }
  }

  async pickTxs(maxBytes: number, minPricePerByte: BigNumber): Promise<ZkTx[]> {
    await this.updateLatestBlock()
    await this.prunePendingTx()
    // TODO add atomic swap tx logic here
    let available = maxBytes
    const sorted = this.getSortedTxs()
    const refValidity = await Promise.all(
      sorted.map(tx => this.hasValidRef(tx)),
    )
    const filtered = sorted.filter((_, i) => refValidity[i])

    const pending: (ZkTx[] | ZkTx)[] = []
    // Add pairing transactions first
    const swapTxs: { [txHash: string]: ZkTx } = {}
    filtered
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

    filtered
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
        const expectedFee = minPricePerByte.mul(size)
        logger.info(
          `coordinator/tx-pool.ts - expected fee: ${expectedFee.toString()}`,
        )
        logger.info(`coordinator/tx-pool.ts - tx.fee: ${tx.fee.toString()}`)
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
        const expectedFee = minPricePerByte.mul(size)
        const swapFee = tx[0].fee.add(tx[1].fee)
        logger.info(
          `coordinator/tx-pool.ts - expected fee: ${expectedFee.toString()}`,
        )
        logger.info(`coordinator/tx-pool.ts - tx.fee: ${swapFee.toString()}`)
        if (available >= size && swapFee.gte(expectedFee)) {
          available -= size
          fee = fee.add(swapFee)
          picked.push(tx[0], tx[1])
        }
      }
    }
    logger.info(`coordinator/tx-pool.ts - fee: ${fee}`)
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
      // TODO: validate transactions before trying to include again
      // txs.forEach(this.addToTxPool.bind(this))
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

  private async hasValidRef(tx: ZkTx): Promise<boolean> {
    const validity = (
      await Promise.all(
        tx.inflow.map(inflow => this.isValidRef(inflow.root.toUint256())),
      )
    ).reduce((prevResult, result) => prevResult && result, true)
    return validity
  }

  private async isValidRef(inclusionRef: Uint256): Promise<boolean> {
    if (!this.latest) throw Error('Failed to fetch the latest l2 block')
    // Find the header of the referenced utxo root
    const headers = await this.layer2.db.findMany('Header', {
      where: {
        utxoRoot: inclusionRef.toString(),
      },
    })
    // If any of the found header is finalized, it returns true
    const finalized = await this.layer2.db.findMany('Proposal', {
      where: {
        hash: headers.map(h => h.hash),
      },
    })
    // TODO: use index when booleans are supported
    if (finalized.find(p => p.finalized === true)) return true
    // Or check the recent precedent blocks has that utxo tree root
    let childBlockHeader: HeaderSql | undefined
    for (let i = 0; i < this.layer2.config.referenceDepth; i += 1) {
      if (!childBlockHeader) {
        const childBlock = await this.layer2.db.findOne('Block', {
          where: { hash: this.latest.toString() },
          include: { header: true, slash: true },
        })
        childBlockHeader = childBlock.header
        // this is the case when a client created a tx with the latest synced block.
        if (
          childBlockHeader &&
          inclusionRef.eq(Uint256.from(childBlockHeader.utxoRoot))
        )
          return true
      }
      assert(childBlockHeader)
      const parentBlock = await this.layer2.db.findOne('Block', {
        where: { hash: childBlockHeader.parentBlock },
        include: { header: true, slash: true },
      })
      childBlockHeader = parentBlock.header
      if (parentBlock === null || parentBlock.slash !== null) {
        return false
      }
      if (inclusionRef.eq(Uint256.from(parentBlock.header.utxoRoot))) {
        return true
      }
    }
    return false
  }

  private async updateLatestBlock() {
    this.latest = await this.layer2.latestBlock()
  }
}
