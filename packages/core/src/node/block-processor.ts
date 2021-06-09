/* eslint-disable @typescript-eslint/camelcase */
import { ZkViewer } from '@zkopru/account'
import { Fp } from '@zkopru/babyjubjub'
import {
  DB,
  BlockCache,
  Proposal,
  MassDeposit as MassDepositSql,
  TransactionDB,
} from '@zkopru/database'
import { logger, Worker } from '@zkopru/utils'
import assert from 'assert'
import BN from 'bn.js'
import { EventEmitter } from 'events'
import {
  OutflowType,
  TokenRegistry,
  Utxo,
  UtxoStatus,
  Withdrawal,
  WithdrawalStatus,
  ZkOutflow,
  ZkTx,
} from '@zkopru/transaction'
import { Bytes32, Address, Uint256 } from 'soltypes'
import AsyncLock from 'async-lock'
import { L2Chain, Patch } from '../context/layer2'
import { Block, Header, massDepositHash } from '../block'
import { ChallengeTx, ValidatorBase as Validator } from '../validator'
import { Tracker } from './tracker'

interface BlockProcessorEvents {
  slash: (challenge: { tx: ChallengeTx; block: Block }) => void
  processed: (proposal: { proposalNum: number; block?: Block }) => void
}

export declare interface BlockProcessor {
  on<U extends keyof BlockProcessorEvents>(
    event: U,
    listener: BlockProcessorEvents[U],
  ): this

  emit<U extends keyof BlockProcessorEvents>(
    event: U,
    ...args: Parameters<BlockProcessorEvents[U]>
  ): boolean
}

export class BlockProcessor extends EventEmitter {
  db: DB

  blockCache: BlockCache

  layer2: L2Chain

  tracker: Tracker

  validator: Validator

  worker: Worker<void>

  canonicalLock = new AsyncLock()

  constructor({
    db,
    blockCache,
    l2Chain,
    tracker,
    validator,
  }: {
    db: DB
    blockCache: BlockCache
    l2Chain: L2Chain
    tracker: Tracker
    validator: Validator
  }) {
    super()
    this.db = db
    this.blockCache = blockCache
    this.layer2 = l2Chain
    this.tracker = tracker
    this.validator = validator
    this.worker = new Worker<void>()
  }

  isRunning(): boolean {
    return this.worker.isRunning()
  }

  start() {
    if (!this.isRunning()) {
      this.worker.start({
        task: this.processBlocks.bind(this),
        interval: 5000,
      })
    } else {
      logger.info('already on syncing')
    }
  }

  async stop() {
    if (this.isRunning()) {
      await this.worker.close()
    } else {
      logger.info('already stopped')
    }
  }

  private async processBlocks() {
    while (this.isRunning()) {
      try {
        const unprocessed = await this.layer2.getOldestUnprocessedBlock()
        logger.trace(`unprocessed: ${unprocessed}`)
        if (!unprocessed) {
          const latestProcessed = await this.db.findMany('Proposal', {
            where: {
              OR: [{ verified: { ne: null } }, { isUncle: { ne: null } }],
            },
            orderBy: { proposalNum: 'desc' },
            limit: 1,
            include: { block: true },
          })
          const latest = latestProcessed.pop()
          await this.calcCanonicalBlockHeights(latest?.proposalNum)
          this.emit('processed', { proposalNum: latest?.proposalNum || 0 })
          // this.synchronizer.setLatestProcessed(latest?.proposalNum || 0)
          break
        }
        const processedProposalNum = await this.processBlock(unprocessed)
        await this.calcCanonicalBlockHeights(processedProposalNum)
        this.emit('processed', {
          proposalNum: processedProposalNum,
          block: unprocessed.block,
        })
        // this.synchronizer.setLatestProcessed(processedProposalNum)
      } catch (err) {
        // TODO needs to provide roll back & resync option
        // sync & process error
        console.error(err)
        logger.warn(`Failed process a block - ${err}`)
        break
      }
      // eslint-disable-next-line no-constant-condition
    }
  }

  /**
   * Fork choice rule: we choose the oldest valid block when there exists a fork
   * @returns processedAll
   */
  private async processBlock(unprocessed: {
    parent: Header
    block: Block
    proposal: Proposal
  }): Promise<number> {
    const { parent, block, proposal } = unprocessed

    if (!proposal.proposalNum || !proposal.proposedAt)
      throw Error('Invalid proposal data')

    // Check this block is an uncle block
    const isUncle = await this.layer2.isUncleBlock(
      block.header.parentBlock,
      proposal.proposalNum,
    )

    if (isUncle) {
      await this.db.transaction(db => {
        db.update('Proposal', {
          where: { hash: block.hash.toString() },
          update: { isUncle: true },
        })
        db.update('MassDeposit', {
          where: { includedIn: block.hash.toString() },
          update: { includedIn: null },
        })
      })
      // TODO: can not process uncle block's grove patch yet
      return proposal.proposalNum
    }

    logger.info(`Processing block ${block.hash.toString()}`)
    // validate the block details and get challenge if it has any invalid data.
    const challengeTx = await this.validator.validate(parent, block)
    if (challengeTx) {
      // implement challenge here & mark as invalidated
      await this.db.transaction(db => {
        db.update('Proposal', {
          where: { hash: block.hash.toString() },
          update: { verified: false },
        })
        db.update('MassDeposit', {
          where: { includedIn: block.hash.toString() },
          update: { includedIn: null },
        })
        // save transactions and mark them as challenged
        this.saveTransactions(block, db, true)
      })
      logger.warn('challenge')
      // TODO slasher option
      this.emit('slash', {
        tx: challengeTx,
        block,
      })
      return proposal.proposalNum
    }
    const tokenRegistry = await this.layer2.getTokenRegistry()
    // Find decryptable Utxos
    // Performs only upserts
    await this.decryptMyUtxos(
      block.body.txs,
      this.tracker.transferTrackers,
      tokenRegistry,
    )
    // Find withdrawals to track
    // Performs only upserts
    await this.saveMyWithdrawals(
      block.body.txs,
      this.tracker.withdrawalTrackers,
    )
    // generate a patch, performs only reads
    const patch = await this.makePatch(parent, block)
    await this.db.transaction(async db => {
      // Performs creations, start tx here
      this.saveTransactions(block, db)
      await this.applyPatch(patch, db)
      // Mark as verified
      db.update('Proposal', {
        where: { hash: block.hash.toString() },
        update: {
          verified: true,
          isUncle: isUncle ? true : null,
        },
      })
    })
    // TODO remove proposal data if it completes verification or if the block is finalized
    return proposal.proposalNum
  }

  private async decryptMyUtxos(
    txs: ZkTx[],
    accounts: ZkViewer[],
    tokenRegistry: TokenRegistry,
  ) {
    const txsWithMemo = txs.filter(tx => tx.memo)
    logger.info(`saveMyUtxos`)
    const myUtxos: Utxo[] = []
    // Try to decrypt
    for (const tx of txsWithMemo) {
      for (const account of accounts) {
        const note = account.decrypt(tx, tokenRegistry)
        logger.info(`decrypt result ${note}`)
        if (note) {
          myUtxos.push(note)
        }
      }
    }
    const inputs = myUtxos.map(note => {
      return {
        hash: note
          .hash()
          .toUint256()
          .toString(),
        eth: note
          .eth()
          .toUint256()
          .toString(),
        owner: note.owner.toString(),
        salt: note.salt.toUint256().toString(),
        tokenAddr: note
          .tokenAddr()
          .toAddress()
          .toString(),
        erc20Amount: note
          .erc20Amount()
          .toUint256()
          .toString(),
        nft: note
          .nft()
          .toUint256()
          .toString(),
        status: UtxoStatus.UNSPENT,
        usedAt: null,
      }
    })
    await this.db.transaction(db => {
      inputs.map(input =>
        db.upsert('Utxo', {
          where: { hash: input.hash },
          create: input,
          update: input,
        }),
      )
    })
  }

  // eslint-disable-next-line class-methods-use-this
  private saveTransactions(
    block: Block,
    db: TransactionDB,
    challenged = false,
  ) {
    block.body.txs.forEach(tx => {
      db.create('Tx', {
        hash: tx.hash().toString(),
        blockHash: block.hash.toString(),
        inflowCount: tx.inflow.length,
        outflowCount: tx.outflow.length,
        fee: tx.fee.toHex(),
        challenged,
        slashed: false,
      })
      db.delete('PendingTx', {
        where: { hash: tx.hash().toString() },
      })
    })
  }

  private async saveMyWithdrawals(txs: ZkTx[], accounts: Address[]) {
    logger.info(`saveMyWithdrawals`)
    const outflows = txs.reduce(
      (acc, tx) => [
        ...acc,
        ...tx.outflow.filter(outflow =>
          outflow.outflowType.eqn(OutflowType.WITHDRAWAL),
        ),
      ],
      [] as ZkOutflow[],
    )
    logger.debug(
      `withdrawal address =>
      ${outflows.map(outflow => outflow.data?.to.toAddress().toString())}`,
    )
    logger.debug(`my address =>${accounts.map(account => account.toString())}`)
    const myWithdrawalOutputs: ZkOutflow[] = outflows.filter(
      outflow =>
        outflow.data &&
        accounts
          .map(account => account.toString())
          .includes(outflow.data?.to.toAddress().toString()),
    )
    // TODO needs batch transaction
    for (const output of myWithdrawalOutputs) {
      if (!output.data) throw Error('Withdrawal does not have public data')
      const withdrawalSql = {
        hash: output.note.toUint256().toString(),
        withdrawalHash: Withdrawal.withdrawalHash(
          output.note,
          output.data,
        ).toString(),
        to: output.data.to.toAddress().toString(),
        eth: output.data.eth.toUint256().toString(),
        tokenAddr: output.data.tokenAddr.toAddress().toString(),
        erc20Amount: output.data.erc20Amount.toUint256().toString(),
        nft: output.data.nft.toUint256().toString(),
        fee: output.data.fee.toUint256().toString(),
      }
      logger.info(`found my withdrawal: ${withdrawalSql.hash}`)
      await this.db.upsert('Withdrawal', {
        where: { hash: withdrawalSql.hash },
        create: withdrawalSql,
        update: withdrawalSql,
      })
    }
  }

  private async makePatch(parent: Header, block: Block): Promise<Patch> {
    // grove patch verification
    const treePatch = await this.layer2.getGrovePatch(block)
    const patch: Patch = {
      block: block.hash,
      massDeposits: block.body.massDeposits.map(massDepositHash),
      treePatch,
      header: block.header,
      prevHeader: parent,
      nullifiers: block.body.txs.reduce((arr, tx) => {
        return [
          ...arr,
          ...tx.inflow.map(inflow => inflow.nullifier.toUint256()),
        ]
      }, [] as Uint256[]),
    }
    return patch
  }

  private async applyPatch(patch: Patch, db: TransactionDB) {
    logger.trace('layer2.ts: applyPatch()')
    const { block, treePatch, massDeposits } = patch
    db.update('Utxo', {
      where: { nullifier: treePatch.nullifiers.map(v => v.toString()) },
      update: {
        status: UtxoStatus.SPENT,
        usedAt: block.toString(),
      },
    })
    logger.trace('nullify used utxos')
    // Update mass deposits inclusion status
    if (massDeposits) {
      await this.markMassDepositsAsIncludedIn(massDeposits, block, db)
    }
    logger.trace('mark mass deposits included in the given block')

    db.update('Utxo', {
      where: {
        hash: (patch.treePatch?.utxos || []).map(utxo =>
          utxo.hash.toUint256().toString(),
        ),
      },
      update: { status: UtxoStatus.UNSPENT },
    })
    logger.trace('mark utxos as unspent')
    db.update('Withdrawal', {
      where: {
        hash: (patch.treePatch?.withdrawals || []).map(withdrawal => {
          assert(withdrawal.noteHash)
          return withdrawal.noteHash.toString()
        }),
      },
      update: { status: WithdrawalStatus.UNFINALIZED },
    })
    logger.trace('mark withdrawals as unfinalized')
    // Apply tree patch
    await this.layer2.grove.applyGrovePatch(treePatch, db)
    await this.updateMyUtxos(this.tracker.transferTrackers, patch, db)
    logger.trace('update my utxos')
    await this.updateMyWithdrawals(this.tracker.withdrawalTrackers, patch, db)
    logger.trace('update my withdrawals')
  }

  private async markMassDepositsAsIncludedIn(
    massDepositHashes: Bytes32[],
    block: Bytes32,
    db: TransactionDB,
  ) {
    const nonIncluded = await this.db.findMany('MassDeposit', {
      where: {
        includedIn: null,
      },
    })
    const candidates: { [index: string]: MassDepositSql } = {}
    nonIncluded.forEach(md => {
      candidates[md.index] = md
    })

    // TODO need batch query
    const indexes: string[] = []
    for (const hash of massDepositHashes) {
      for (const index of Object.keys(candidates).sort()) {
        const md = candidates[index]
        if (
          hash.eq(
            massDepositHash({
              merged: Bytes32.from(md.merged),
              fee: Uint256.from(md.fee),
            }),
          )
        ) {
          indexes.push(index)
          delete candidates[index]
          break
        }
      }
    }
    if (indexes.length === 0) return
    db.update('MassDeposit', {
      where: { index: indexes },
      update: { includedIn: block.toString() },
    })
  }

  private async updateMyUtxos(
    accounts: ZkViewer[],
    patch: Patch,
    db: TransactionDB,
  ) {
    // Find utxos that I've created
    const myStoredUtxos = await this.db.findMany('Utxo', {
      where: {
        hash: patch.treePatch.utxos.map(leaf => leaf.hash.toString()),
        owner: accounts.map(account => account.zkAddress.toString()),
      },
    })
    const startingUtxoIndex = patch.prevHeader.utxoIndex.toBN()
    const utxosToUpdate: {
      hash: string
      index: string
      nullifier: string
    }[] = []
    for (const utxoData of myStoredUtxos) {
      const orderInArr = patch.treePatch.utxos.findIndex(utxo =>
        utxo.hash.eq(Fp.from(utxoData.hash)),
      )
      assert(orderInArr >= 0)
      const index = Fp.from(startingUtxoIndex.addn(orderInArr).toString())
      const viewer = accounts.find(
        account => account.zkAddress.toString() === utxoData.owner,
      )
      if (!viewer) throw new Error('Cannot create nullifier')
      const nullifier = Utxo.nullifier(viewer.getNullifierSeed(), index)
      utxosToUpdate.push({
        hash: utxoData.hash,
        index: index.toString(),
        nullifier: nullifier.toString(),
      })
    }
    utxosToUpdate.forEach(utxo =>
      db.update('Utxo', {
        where: { hash: utxo.hash },
        update: {
          index: utxo.index,
          nullifier: utxo.nullifier,
        },
      }),
    )
  }

  private async updateMyWithdrawals(
    accounts: Address[],
    patch: Patch,
    db: TransactionDB,
  ) {
    const myStoredWithdrawals = await this.db.findMany('Withdrawal', {
      where: {
        hash: patch.treePatch.withdrawals.map(leaf => {
          if (!leaf.noteHash) throw Error('Patch should provide noteHash field')
          return leaf.noteHash?.toString()
        }),
        to: accounts.map(account => account.toString()),
      },
    })
    const startingWithdrawalIndex = patch.prevHeader.withdrawalIndex.toBN()
    const withdrawalsToUpdate: {
      hash: string
      index: string
      includedIn: string
      siblings: string
    }[] = []
    for (const withdrawalData of myStoredWithdrawals) {
      const orderInArr = patch.treePatch.withdrawals.findIndex(withdrawal =>
        new BN(withdrawalData.withdrawalHash).eq(withdrawal.hash),
      )
      assert(orderInArr >= 0)
      const index = startingWithdrawalIndex.addn(orderInArr)
      const { noteHash } = patch.treePatch.withdrawals[orderInArr]
      if (!noteHash) throw Error('Withdrawal does not have note hash')
      const merkleProof = await this.layer2.grove.withdrawalMerkleProof(
        noteHash,
        index,
      )
      withdrawalsToUpdate.push({
        hash: withdrawalData.hash,
        index: index.toString(),
        includedIn: patch.block.toString(),
        siblings: JSON.stringify(
          merkleProof.siblings.map(sib => sib.toString(10)),
        ),
      })
    }
    withdrawalsToUpdate.forEach(withdrawal =>
      db.update('Withdrawal', {
        where: { hash: withdrawal.hash },
        update: {
          index: withdrawal.index,
          includedIn: withdrawal.includedIn,
          siblings: withdrawal.siblings,
        },
      }),
    )
  }

  // idempotently calculate canonical numbers
  private async calcCanonicalBlockHeights(latestProcessed = 0) {
    await this.canonicalLock.acquire('canon', async () => {
      // find earliest block with no canonical num
      const startBlock = await this.db.findMany('Proposal', {
        where: {
          canonicalNum: null,
          OR: [{ proposalData: { ne: null } }, { proposalNum: 0 }],
        },
        orderBy: { proposalNum: 'asc' },
        limit: 1,
      })
      if (startBlock.length === 0) {
        // have canonical numbers for all blocks
        return
      }
      // The proposal to start at
      const [{ proposalNum }] = startBlock
      if (proposalNum === null) {
        throw new Error('Proposal number is null')
      }
      const blockHeight = await this.db.count('Proposal', {})
      for (
        let x = proposalNum;
        x <= Math.min(blockHeight, latestProcessed);
        x += 1
      ) {
        await this.calcCanonicalBlockHeight(x)
      }
    })
  }

  private async calcCanonicalBlockHeight(proposalNum: number) {
    const proposals = await this.db.findMany('Proposal', {
      where: { proposalNum },
    })
    if (proposals.length !== 1) {
      throw new Error(`Did not find one proposal for number: ${proposalNum}`)
    }
    const [proposal] = proposals
    const { hash } = proposal
    if (proposalNum === 0) {
      await this.db.update('Proposal', {
        where: { hash },
        update: { canonicalNum: 0 },
      })
      return
    }
    if (!proposal.proposalData) return
    const block = Block.fromTx(JSON.parse(proposal.proposalData))
    const header = block.getHeaderSql()
    const parent = await this.db.findOne('Proposal', {
      where: {
        hash: header.parentBlock.toString(),
      },
    })
    if (!parent) {
      throw new Error(`Unable to find parent proposal`)
    }
    if (parent.canonicalNum === null) {
      throw new Error(`Expected canonicalNum to exist!`)
    }
    await this.db.update('Proposal', {
      where: { hash },
      update: { canonicalNum: (parent.canonicalNum as number) + 1 },
    })
  }
}
