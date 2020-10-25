/* eslint-disable @typescript-eslint/camelcase */
import { ZkViewer } from '@zkopru/account'
import { DB, Proposal } from '@zkopru/prisma'
import { logger, Worker } from '@zkopru/utils'
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
import { Address, Uint256 } from 'soltypes'
import { TransactionObject } from '@zkopru/contracts'
import { L1Contract } from '../context/layer1'
import { L2Chain, Patch } from '../context/layer2'
import { Block, Header, massDepositHash } from '../block'
import { OffchainValidator, OnchainValidator } from '../validator'
import { Tracker } from './tracker'

export abstract class BlockProcessor extends EventEmitter {
  db: DB

  layer2: L2Chain

  tracker: Tracker

  validators: {
    onchain: OnchainValidator
    offchain: OffchainValidator
  }

  worker: Worker<void>

  constructor({
    db,
    l1Contract,
    l2Chain,
    tracker,
  }: {
    db: DB
    l1Contract: L1Contract
    l2Chain: L2Chain
    tracker: Tracker
  }) {
    super()
    this.db = db
    this.layer2 = l2Chain
    this.tracker = tracker
    this.validators = {
      onchain: new OnchainValidator(l1Contract),
      offchain: new OffchainValidator(l2Chain),
    }
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

  async saveMyUtxos(
    txs: ZkTx[],
    accounts: ZkViewer[],
    tokenRegistry: TokenRegistry,
  ) {
    const txsWithMemo = txs.filter(tx => tx.memo)
    logger.info(`saveMyUtxos`)
    const myUtxos: Utxo[] = []
    for (const tx of txsWithMemo) {
      for (const account of accounts) {
        const note = account.decrypt(tx, tokenRegistry)
        logger.info(`decrypt result ${note}`)
        if (note) myUtxos.push(note)
      }
    }
    const inputs = myUtxos.map(note => ({
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
    }))
    await this.db.write(prisma =>
      prisma.$transaction(
        inputs.map(input =>
          prisma.utxo.upsert({
            where: { hash: input.hash },
            create: input,
            update: input,
          }),
        ),
      ),
    )
  }

  async saveMyWithdrawals(txs: ZkTx[], accounts: Address[]) {
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
        status: WithdrawalStatus.WITHDRAWABLE,
      }
      logger.info(`found my withdrawal: ${withdrawalSql.hash}`)
      await this.db.write(prisma =>
        prisma.withdrawal.upsert({
          where: { hash: withdrawalSql.hash },
          create: withdrawalSql,
          update: withdrawalSql,
        }),
      )
    }
  }

  private async processBlocks() {
    while (this.isRunning()) {
      try {
        const unprocessed = await this.layer2.getOldestUnprocessedBlock()
        logger.trace(`unprocessed: ${unprocessed}`)
        if (!unprocessed) {
          const latestProcessed = await this.db.read(prisma =>
            prisma.proposal.findMany({
              where: {
                OR: [{ verified: { not: null } }, { isUncle: { not: null } }],
              },
              orderBy: { proposalNum: 'desc' },
              take: 1,
              include: { block: true },
            }),
          )
          const latest = latestProcessed.pop()
          this.emit('processed', latest?.proposalNum || 0)
          // this.synchronizer.setLatestProcessed(latest?.proposalNum || 0)
          break
        }
        const processedProposalNum = await this.processBlock(unprocessed)
        this.emit('processed', processedProposalNum)
        // this.synchronizer.setLatestProcessed(processedProposalNum)
      } catch (err) {
        // TODO needs to provide roll back & resync option
        // sync & process error
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
      await this.db.write(prisma =>
        prisma.proposal.update({
          where: { hash: block.hash.toString() },
          data: { isUncle: true },
        }),
      )
      await this.db.write(prisma =>
        prisma.massDeposit.updateMany({
          where: { includedIn: block.hash.toString() },
          data: { includedIn: null },
        }),
      )
      // TODO: can not process uncle block's grove patch yet
      return proposal.proposalNum
    }

    logger.info(`Processing block ${block.hash.toString()}`)
    // validate the block details and get challenge if it has any invalid data.
    const slashTx = await this.validate(parent, block)
    if (slashTx) {
      // implement challenge here & mark as invalidated
      await this.db.write(prisma =>
        prisma.proposal.update({
          where: { hash: block.hash.toString() },
          data: { verified: false },
        }),
      )
      await this.db.write(prisma =>
        prisma.massDeposit.updateMany({
          where: { includedIn: block.hash.toString() },
          data: { includedIn: null },
        }),
      )
      logger.warn('challenge')
      // TODO slasher option
      this.emit('slash', slashTx)
      return proposal.proposalNum
    }
    // generate a patch
    const patch = await this.makePatch(parent, block)
    // check if there exists fork
    const tokenRegistry = await this.layer2.getTokenRegistry()
    await this.saveMyUtxos(
      block.body.txs,
      this.tracker.transferTrackers,
      tokenRegistry,
    )
    await this.saveMyWithdrawals(
      block.body.txs,
      this.tracker.withdrawalTrackers,
    )
    await this.layer2.applyPatch(patch)
    // Mark as verified
    await this.db.write(prisma =>
      prisma.proposal.update({
        where: { hash: block.hash.toString() },
        data: {
          verified: true,
          isUncle: isUncle ? true : null,
        },
      }),
    )
    // TODO remove proposal data if it completes verification or if the block is finalized
    return proposal.proposalNum
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

  abstract validate(
    parent: Header,
    block: Block,
  ): Promise<TransactionObject<{
    slash: boolean
    reason: string
    0: boolean
    1: string
  }> | null>
}
