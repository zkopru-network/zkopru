/* eslint-disable @typescript-eslint/camelcase */
import { ZkViewer } from '@zkopru/account'
import { Fp } from '@zkopru/babyjubjub'
import { DB, Proposal, MassDeposit as MassDepositSql } from '@zkopru/database'
import { logger, Worker } from '@zkopru/utils'
import { Leaf } from '@zkopru/tree'
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

  layer2: L2Chain

  tracker: Tracker

  validator: Validator

  worker: Worker<void>

  constructor({
    db,
    l2Chain,
    tracker,
    validator,
  }: {
    db: DB
    l2Chain: L2Chain
    tracker: Tracker
    validator: Validator
  }) {
    super()
    this.db = db
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
              OR: [{ verified: { ne: null }}, { isUncle: { ne: null }}],
            },
            orderBy: { proposalNum: 'desc' },
            limit: 1,
            include: { block: true },
          })
          // const latestProcessed = await this.db.read(prisma =>
          //   prisma.proposal.findMany({
          //     where: {
          //       OR: [{ verified: { not: null } }, { isUncle: { not: null } }],
          //     },
          //     orderBy: { proposalNum: 'desc' },
          //     take: 1,
          //     include: { block: true },
          //   }),
          // )
          const latest = latestProcessed.pop()
          this.emit('processed', { proposalNum: latest?.proposalNum || 0 })
          // this.synchronizer.setLatestProcessed(latest?.proposalNum || 0)
          break
        }
        const processedProposalNum = await this.processBlock(unprocessed)
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
      await this.db.update('Proposal', {
        where: { hash: block.hash.toString() },
        update: { isUncle: true },
      })
      await this.db.update('MassDeposit', {
        where: { includedIn: block.hash.toString() },
        update: { includedIn: null },
      })
      // TODO: can not process uncle block's grove patch yet
      return proposal.proposalNum
    }

    logger.info(`Processing block ${block.hash.toString()}`)
    // validate the block details and get challenge if it has any invalid data.
    const challengeTx = await this.validator.validate(parent, block)
    if (challengeTx) {
      // implement challenge here & mark as invalidated
      await this.db.update('Proposal', {
        where: { hash: block.hash.toString() },
        update: { verified: false },
      })
      await this.db.update('MassDeposit', {
        where: { includedIn: block.hash.toString() },
        update: { includedIn: null },
      })
      // save transactions and mark them as challenged
      await this.saveTransactions(block, true)
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
    await this.decryptMyUtxos(
      block.body.txs,
      this.tracker.transferTrackers,
      tokenRegistry,
    )
    // Find withdrawals to track
    await this.saveMyWithdrawals(
      block.body.txs,
      this.tracker.withdrawalTrackers,
    )
    await this.saveTransactions(block)
    // generate a patch
    const patch = await this.makePatch(parent, block)
    await this.applyPatch(patch)
    // Mark as verified
    await this.db.update('Proposal', {
      where: { hash: block.hash.toString() },
      update: {
        verified: true,
        isUncle: isUncle ? true : null,
      },
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
    // TODO use a mutex lock here
    const promises = [] as Promise<any>[]
    for (const input of inputs) {
      promises.push(this.db.upsert('Utxo', {
        where: { hash: input.hash },
        create: input,
        update: input,
      }))
    }
    await Promise.all(promises)
    // await this.db.write(prisma =>
    //   prisma.$transaction(
    //     inputs.map(input =>
    //       prisma.utxo.upsert({
    //         where: { hash: input.hash },
    //         create: input,
    //         update: input,
    //       }),
    //     ),
    //   ),
    // )
  }

  private async saveTransactions(block: Block, challenged = false) {
    for (const tx of block.body.txs) {
      await this.db.create('Tx', {
        hash: tx.hash().toString(),
        blockHash: block.hash.toString(),
        inflowCount: tx.inflow.length,
        outflowCount: tx.outflow.length,
        fee: tx.fee.toHex(),
        challenged,
        slashed: false,
      })
    }
    // await this.db.write(prisma =>
    //   prisma.$transaction(
    //     block.body.txs.map(tx =>
    //       prisma.tx.create({
    //         data: {
    //           hash: tx.hash().toString(),
    //           blockHash: block.hash.toString(),
    //           inflowCount: tx.inflow.length,
    //           outflowCount: tx.outflow.length,
    //           fee: tx.fee.toHex(),
    //           challenged,
    //           slashed: false,
    //         },
    //       }),
    //     ),
    //   ),
    // )
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

  private async applyPatch(patch: Patch) {
    logger.trace('layer2.ts: applyPatch()')
    const { block, treePatch, massDeposits } = patch
    await this.nullifyUsedUtxos(block, treePatch.nullifiers)
    logger.trace('nullify used utxos')
    // Update mass deposits inclusion status
    if (massDeposits) {
      await this.markMassDepositsAsIncludedIn(massDeposits, block)
    }
    logger.trace('mark mass deposits included in the given block')
    await this.markUtxosAsUnspent(patch.treePatch?.utxos || [])
    logger.trace('mark utxos as unspent')
    await this.markWithdrawalsAsUnfinalized(patch.treePatch?.withdrawals || [])
    logger.trace('mark withdrawals as unfinalized')
    // Apply tree patch
    await this.layer2.grove.applyGrovePatch(treePatch)
    await this.updateMyUtxos(this.tracker.transferTrackers, patch)
    logger.trace('update my utxos')
    await this.updateMyWithdrawals(this.tracker.withdrawalTrackers, patch)
    logger.trace('update my withdrawals')
  }

  private async markUtxosAsUnspent(utxos: Leaf<Fp>[]) {
    await this.db.update('Utxo', {
      where: {
        hash: utxos.map(utxo => utxo.hash.toUint256().toString()),
      },
      update: { status: UtxoStatus.UNSPENT },
    })
  }

  private async markWithdrawalsAsUnfinalized(withdrawals: Leaf<BN>[]) {
    await this.db.update('Withdrawal', {
      where: {
        hash: withdrawals.map(withdrawal => {
          assert(withdrawal.noteHash)
          return withdrawal.noteHash.toString()
        }),
      },
      update: { status: WithdrawalStatus.UNFINALIZED },
    })
  }

  private async markMassDepositsAsIncludedIn(
    massDepositHashes: Bytes32[],
    block: Bytes32,
  ) {
    const nonIncluded = await this.db.findMany('MassDeposit', {
      where: {
        includedIn: null,
      }
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
    await this.db.update('MassDeposit', {
      where: { index: { in: indexes } },
      update: { includedIn: block.toString() },
    })
  }

  private async nullifyUsedUtxos(blockHash: Bytes32, nullifiers: BN[]) {
    await this.db.update('Utxo', {
      where: { nullifier: nullifiers.map(v => v.toString()) },
      update: {
        status: UtxoStatus.SPENT,
        usedAt: blockHash.toString(),
      },
    })
  }

  private async updateMyUtxos(accounts: ZkViewer[], patch: Patch) {
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
      if (!viewer) throw Error('Cannot create nullifier')
      const nullifier = Utxo.nullifier(viewer.getNullifierSeed(), index)
      utxosToUpdate.push({
        hash: utxoData.hash,
        index: index.toString(),
        nullifier: nullifier.toString(),
      })
    }
    for (const utxo of utxosToUpdate) {
      await this.db.update('Utxo', {
        where: { hash: utxo.hash },
        update: {
          index: utxo.index,
          nullifier: utxo.nullifier,
        },
      })
    }
    // await this.db.write(prisma =>
    //   prisma.$transaction(
    //     utxosToUpdate.map(utxo =>
    //       prisma.utxo.update({
    //         where: { hash: utxo.hash },
    //         data: {
    //           index: utxo.index,
    //           nullifier: utxo.nullifier,
    //         },
    //       }),
    //     ),
    //   ),
    // )
  }

  private async updateMyWithdrawals(accounts: Address[], patch: Patch) {
    const myStoredWithdrawals = await this.db.findMany('Withdrawal', {
      where: {
        hash: patch.treePatch.withdrawals.map(leaf => {
          if (!leaf.noteHash)
            throw Error('Patch should provide noteHash field')
          return leaf.noteHash?.toString()
        }),
        to: accounts.map(account => account.toString()),
      }
    })
    // const myStoredWithdrawals = await this.db.read(prisma =>
    //   prisma.withdrawal.findMany({
    //     where: {
    //       hash: {
    //         in: patch.treePatch.withdrawals.map(leaf => {
    //           if (!leaf.noteHash)
    //             throw Error('Patch should provide noteHash field')
    //           return leaf.noteHash?.toString()
    //         }),
    //       },
    //       to: { in: accounts.map(account => account.toString()) },
    //     },
    //   }),
    // )
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
    for (const withdrawal of withdrawalsToUpdate) {
      await this.db.update('Withdrawal', {
        where: { hash: withdrawal.hash },
        update: {
          index: withdrawal.index,
          includedIn: withdrawal.includedIn,
          siblings: withdrawal.siblings,
        },
      })
    }
    // await this.db.write(prisma =>
    //   prisma.$transaction(
    //     withdrawalsToUpdate.map(withdrawal =>
    //       prisma.withdrawal.update({
    //         where: { hash: withdrawal.hash },
    //         data: {
    //           index: withdrawal.index,
    //           includedIn: withdrawal.includedIn,
    //           siblings: withdrawal.siblings,
    //         },
    //       }),
    //     ),
    //   ),
    // )
  }
}
