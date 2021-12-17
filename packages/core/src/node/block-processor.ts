/* eslint-disable @typescript-eslint/camelcase */
/* eslint dot-notation: ["error", { "allowPattern": "^(_[a-z]+)+$" }] */
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
import fetch from 'node-fetch'
import pako from 'pako'
import { StringDecoder } from 'string_decoder'
import { L2Chain, Patch } from '../context/layer2'
import { Block, Header, massDepositHash } from '../block'
import { ValidatorBase as Validator } from '../validator'
import { Tracker } from './tracker'
import { Validation } from '../validator/types'
import { L1Contract } from '../context/layer1'
import { CoordinatorManager } from '../coordinator-manager'

interface BlockProcessorEvents {
  slash: (challenge: Validation & { block: Block }) => void
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

  layer1: L1Contract

  layer2: L2Chain

  tracker: Tracker

  validator: Validator

  worker: Worker<void>

  canonicalLock = new AsyncLock()

  lastEmittedProposalNum = -1

  activeFastSync?: {
    latestHash: string
  }

  constructor({
    db,
    blockCache,
    l2Chain,
    tracker,
    validator,
    l1Contract,
  }: {
    db: DB
    blockCache: BlockCache
    l2Chain: L2Chain
    tracker: Tracker
    validator: Validator
    l1Contract: L1Contract
  }) {
    super()
    logger.trace(`core/block-processor - BlockProcessor::constructor()`)
    this.db = db
    this.blockCache = blockCache
    this.layer2 = l2Chain
    this.tracker = tracker
    this.validator = validator
    this.worker = new Worker<void>()
    this.layer1 = l1Contract
  }

  isRunning(): boolean {
    return this.worker.isRunning()
  }

  start() {
    logger.trace(`core/block-processor - BlockProcessor::start()`)
    if (!this.isRunning()) {
      this.worker.start({
        task: this.processBlocks.bind(this),
        interval: 5000,
      })
    } else {
      logger.info(`core/block-processor - a processor is already running`)
    }
  }

  async stop() {
    logger.trace(`core/block-processor - BlockProcessor::stop()`)
    if (this.isRunning()) {
      await this.worker.close()
    } else {
      logger.info(`core/block-processor - the processor is already stopped`)
    }
  }

  private async attemptFastSync() {
    const activeFastSync = await this.db.findOne('FastSync', {
      where: {},
    })
    console.log('active fast sync', activeFastSync)
    const treeNodeCount = await this.db.count('TreeNode', {})
    // no fast sync needed
    if (!activeFastSync && treeNodeCount > 0) return
    if (activeFastSync) {
      // continue the active fast sync
      this.activeFastSync = activeFastSync
    } else if (treeNodeCount === 0) {
      // load the tree node data
      const manager = new CoordinatorManager(
        this.layer1.address,
        this.layer1.web3,
      )
      let urls = await manager.loadUrls()
      urls = ['http://localhost:8888']
      if (urls.length === 0) return
      try {
        const r = await fetch(`${urls[0]}/fastsync`)
        const data = await r.arrayBuffer()
        // now we need to de-gzip it
        const output = pako.inflate(data)
        const decoder = new StringDecoder('utf8')
        const outputString = decoder.end(Buffer.from(output))
        const obj = JSON.parse(outputString)
        console.log(obj.headerHash)
        await this.db.transaction(db => {
          // wipe existing trees
          db.delete('LightTree', {
            where: {},
          })
          // create new ones from coordinator data
          db.create('LightTree', obj.lightTrees)
          db.create('TreeNode', obj.treeNodes)
          // create a record of the fast sync so we can resume later or abort
          // if the merkle root is incorrect
          db.create('FastSync', {
            latestHash: obj.headerHash,
          })
        })
        // re-init the grove and in memory rollup trees with new data
        await this.layer2.grove.init()
        this.activeFastSync = {
          latestHash: obj.headerHash,
        }
      } catch (err) {
        console.log('fast sync errored')
        console.log(err)
      }
    }
  }

  private async processBlocks() {
    await this.attemptFastSync()
    logger.trace(`core/block-processor - BlockProcessor::processBlocks()`)
    while (this.isRunning()) {
      try {
        const unprocessed = await this.layer2.getOldestUnprocessedBlock()
        logger.trace(
          `core/block-processor - unprocessed: #${unprocessed?.proposal.proposalNum}`,
        )
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
          if (this.lastEmittedProposalNum !== latest?.proposalNum) {
            this.lastEmittedProposalNum = latest?.proposalNum
            this.emit('processed', { proposalNum: latest?.proposalNum || 0 })
          }
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
        logger.warn(
          `core/block-processor - Failed to process a block - ${JSON.stringify(
            err,
          )}`,
        )
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
    logger.trace(
      `core/block-processor - BlockProcessor::processBlock(${proposal.hash})`,
    )

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

    logger.info(
      `core/block-processor - Processing proposal #${proposal.proposalNum}()`,
    )
    // validate the block details and get challenge if it has any invalid data.
    const validationResult = this.activeFastSync
      ? { slashable: false }
      : await this.validator.validate(parent, block)
    if (validationResult.slashable || block.slashed) {
      // implement challenge here & mark as invalidated
      await this.db.transaction(async db => {
        db.update('Proposal', {
          where: { hash: block.hash.toString() },
          update: { verified: false },
        })
        db.update('MassDeposit', {
          where: { includedIn: block.hash.toString() },
          update: { includedIn: null },
        })
        // save transactions and mark them as challenged
        await this.saveTransactions(block, db, true)
      })
      logger.warn(
        `core/block-processor - challenge: ${validationResult['_method']?.name}`,
      )
      // TODO slasher option
      this.emit('slash', {
        ...validationResult,
        block,
      })
      return proposal.proposalNum
    }
    const tokenRegistry = await this.layer2.getTokenRegistry()
    // generate a patch to current db
    const patch = await this.makePatch(parent, block)
    await this.db.transaction(
      async db => {
        this.layer2.grove.treeCache.enable()
        this.layer2.grove.treeCache.clear()
        await this.saveTransactions(block, db)
        await this.decryptMyUtxos(
          patch,
          block.body.txs,
          this.tracker.transferTrackers,
          tokenRegistry,
          db,
        )
        this.saveWithdrawals(block, this.tracker.withdrawalTrackers, db)
        await this.applyPatch(patch, db)
        // Mark as verified
        db.update('Proposal', {
          where: { hash: block.hash.toString() },
          update: {
            verified: true,
            isUncle: isUncle ? true : null,
          },
        })
        if (
          this.activeFastSync &&
          Fp.from(block.hash.toString()).eq(
            Fp.from(this.activeFastSync.latestHash),
          )
        ) {
          // clear the fast sync if we've processed the latest block
          db.delete('FastSync', {
            where: {
              latestHash: this.activeFastSync.latestHash,
            },
          })
          this.activeFastSync = undefined
        }
      },
      () => {
        this.layer2.grove.treeCache.disable()
        this.layer2.grove.treeCache.clear()
      },
    )
    // TODO remove proposal data if it completes verification or if the block is finalized
    return proposal.proposalNum
  }

  private async decryptMyUtxos(
    patch: Patch,
    txs: ZkTx[],
    accounts: ZkViewer[],
    tokenRegistry: TokenRegistry,
    db: TransactionDB,
  ) {
    logger.trace(`core/block-processor - BlockProcessor::decryptMyUtxos()`)
    const txsWithMemo = txs.filter(tx => tx.memo)
    const myUtxos: Utxo[] = []
    // Try to decrypt
    for (const tx of txsWithMemo) {
      for (const account of accounts) {
        const decrypted = account.decrypt(tx, tokenRegistry)
        logger.info(
          `core/block-processor - decrypt result [${decrypted.map(utxo =>
            utxo
              .hash()
              .toBytes32()
              .toString(),
          )}]`,
        )
        if (decrypted && decrypted.length) {
          myUtxos.push(...decrypted)
          // store some known info about the transaction
          await this.determineTxOwnership(tx, account, decrypted, db)
        }
      }
    }
    const startingUtxoIndex = patch.prevHeader.utxoIndex.toBN()
    if (myUtxos.length > 0) {
      logger.info(
        `core/block-processor - found ${myUtxos.length} UTXO(s) from transactions`,
      )
    }
    const inputs = myUtxos.map(note => {
      // need to generate a nullifier
      const orderInArr = patch.treePatch.utxos.findIndex(utxo =>
        utxo.hash.eq(Fp.from(note.hash())),
      )
      assert(orderInArr >= 0)
      const index = Fp.from(startingUtxoIndex.addn(orderInArr).toString())
      const viewer = this.tracker.transferTrackers.find(t => {
        return t.zkAddress.viewingPubKey().eq(note.owner.viewingPubKey())
      })
      if (!viewer) throw new Error('Cannot create nullifier')
      const nullifier = Utxo.nullifier(viewer.getNullifierSeed(), index)
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
        index: index.toString(),
        nullifier: nullifier.toString(),
      }
    })
    inputs.map(input =>
      db.upsert('Utxo', {
        where: { hash: input.hash },
        create: input,
        update: input,
      }),
    )
  }

  /**
   * Determines and stores inferred tx ownership based on ability to decrypt memo
   * and knowledge of nullifier secrets.
   *
   * If I own only an inflow utxo I am likely the receiver. If I own both an
   * inflow and outflow utxo I am likely the sender.
   * */
  private async determineTxOwnership(
    tx: ZkTx,
    knownReceiver: ZkViewer,
    decryptedNotes: Utxo[],
    db: TransactionDB,
  ) {
    const isWithdrawal =
      tx.outflow.findIndex(({ outflowType }) =>
        outflowType.eqn(OutflowType.WITHDRAWAL),
      ) !== -1
    if (isWithdrawal) return // we don't need to save withdrawal here
    const inflows = await this.db.findMany('Utxo', {
      where: {
        nullifier: tx.inflow.map(inflow => inflow.nullifier.toString()),
      },
    })
    // my outflow amounts
    let tokenAddress: Fp | undefined
    let ethAmount = new BN('0')
    let tokenAmount = new BN('0')
    for (const note of decryptedNotes) {
      if (!tokenAddress && !note.tokenAddr().eq(new BN('0'))) {
        tokenAddress = note.tokenAddr()
      }
      if (tokenAddress && tokenAddress.eq(note.tokenAddr())) {
        tokenAmount = tokenAmount.add(note.erc20Amount())
      }
      ethAmount = ethAmount.add(note.eth())
    }
    if (inflows.length !== tx.inflow.length) {
      // it's a receive transaction because we don't know all the UTXO nullfiers
      db.update('Tx', {
        where: {
          hash: tx.hash().toString(),
        },
        update: {
          receiverAddress: knownReceiver.zkAddress.toString(),
          tokenAddr: tokenAddress ? tokenAddress.toHex().toString() : '0x0',
          eth: ethAmount.toString(),
          erc20Amount: tokenAmount.toString(),
        },
      })
      return
    }
    // otherwise assume it's a send
    const outflowOwners = {}
    let nft = false
    for (const outflow of decryptedNotes) {
      outflowOwners[outflow.owner.toString()] = true
      if (outflow.nft() && +outflow.nft() !== 0) nft = true
    }
    if (nft) {
      logger.warn('core/block-processor - NFT outflow not supported')
      return
    }
    if (Object.keys(outflowOwners).length > 1) {
      logger.warn(
        'core/block-processor - Multiple outflow owners not supported',
      )
      return
    }
    // otherwise we're the sender
    let tokenAmountSent = new BN('0')
    let ethAmountSent = new BN('0')
    for (const inflow of inflows) {
      if (tokenAddress && tokenAddress.eq(Fp.from(inflow.tokenAddr))) {
        tokenAmountSent = tokenAmountSent.add(Fp.from(inflow.erc20Amount))
      }
      ethAmountSent = ethAmountSent.add(Fp.from(inflow.eth))
    }
    const selfTx =
      tokenAmountSent.eq(tokenAmount) && ethAmountSent.sub(tx.fee).eq(ethAmount)
    db.update('Tx', {
      where: {
        hash: tx.hash().toString(),
      },
      update: {
        senderAddress: knownReceiver.zkAddress.toString(),
        receiverAddress: selfTx
          ? knownReceiver.zkAddress.toString()
          : undefined,
        tokenAddr: tokenAddress ? tokenAddress.toHex().toString() : '0x0',
        erc20Amount: tokenAmountSent.sub(tokenAmount).toString(),
        eth: ethAmountSent
          .sub(Fp.from(tx.fee))
          .sub(ethAmount)
          .toString(),
      },
    })
  }

  // eslint-disable-next-line class-methods-use-this
  private async saveTransactions(
    block: Block,
    db: TransactionDB,
    challenged = false,
  ) {
    logger.trace(`core/block-processor - BlockProcessor::saveTransactions()`)
    const promises = block.body.txs.map(async tx => {
      db.delete('PendingTx', {
        where: { hash: tx.hash().toString() },
      })
      const existingTx = await this.db.findOne('Tx', {
        where: {
          hash: tx.hash().toString(),
        },
      })
      if (existingTx) return
      db.create('Tx', {
        hash: tx.hash().toString(),
        blockHash: block.hash.toString(),
        inflowCount: tx.inflow.length,
        outflowCount: tx.outflow.length,
        fee: tx.fee.toHex(),
        challenged,
        slashed: false,
      })
    })
    await Promise.all(promises)
  }

  // eslint-disable-next-line class-methods-use-this
  private saveWithdrawals(
    block: Block,
    accounts: Address[],
    db: TransactionDB,
  ) {
    // Save instant withdrawals from memo field
    {
      const withdrawalTxs = block.body.txs.filter(tx => {
        return (
          tx.outflow.findIndex(outflow =>
            outflow.outflowType.eqn(OutflowType.WITHDRAWAL),
          ) !== -1
        )
      })
      for (const tx of withdrawalTxs) {
        const { prepayInfo } = tx.parseMemo()
        const outflows = tx.outflow.filter(o =>
          o.outflowType.eqn(OutflowType.WITHDRAWAL),
        )
        if (outflows.length === 0) {
          logger.warn('Unable to find withdrawal outflow for memo')
          // eslint-disable-next-line no-continue
          continue
        }
        if (outflows.length > 1) {
          logger.warn('Mutliple withdrawal outflows for memo not supported')
          // eslint-disable-next-line no-continue
          continue
        }
        const outflow = outflows[0] as ZkOutflow
        if (!outflow.data) throw Error('Withdrawal does not have public data')
        const withdrawalHash = Withdrawal.withdrawalHash(
          outflow.note,
          outflow.data,
        ).toString()
        const withdrawalSql = {
          hash: outflow.note.toUint256().toString(),
          withdrawalHash: Withdrawal.withdrawalHash(
            outflow.note,
            outflow.data,
          ).toString(),
          to: outflow.data.to.toAddress().toString(),
          eth: outflow.data.eth.toUint256().toString(),
          tokenAddr: outflow.data.tokenAddr.toAddress().toString(),
          erc20Amount: outflow.data.erc20Amount.toUint256().toString(),
          nft: outflow.data.nft.toUint256().toString(),
          fee: tx.fee.toUint256().toString(),
          includedIn: block.hash.toString(),
        }
        db.upsert('Withdrawal', {
          where: { hash: withdrawalSql.hash },
          create: withdrawalSql,
          update: withdrawalSql,
        })
        if (prepayInfo) {
          const instantWithdrawDoc = {
            signature: `0x${prepayInfo.signature.toString('hex')}`,
            withdrawalHash,
            prepayFeeInEth: prepayInfo.prepayFeeInEth.toString(),
            prepayFeeInToken: prepayInfo.prepayFeeInToken.toString(),
            expiration: prepayInfo.expiration,
            prepayer: '0x0000000000000000000000000000000000000000',
          }
          db.upsert('InstantWithdrawal', {
            where: {
              signature: instantWithdrawDoc.signature,
            },
            create: instantWithdrawDoc,
            update: instantWithdrawDoc,
          })
        }
      }
    }
    // save my withdrawals
    {
      logger.trace(`core/block-processor - BlockProcessor::saveMyWithdrawals()`)
      const outflows = block.body.txs.reduce(
        (acc, tx) => [
          ...acc,
          ...tx.outflow.filter(outflow =>
            outflow.outflowType.eqn(OutflowType.WITHDRAWAL),
          ),
        ],
        [] as ZkOutflow[],
      )
      logger.debug(
        `core/block-processor - withdrawals: [${outflows.map(outflow =>
          outflow.data?.to.toAddress().toString(),
        )}]`,
      )
      logger.debug(
        `core/block-processor - my addresses: ${accounts.map(account =>
          account.toString(),
        )}`,
      )
      const myWithdrawalOutputs: ZkOutflow[] = outflows.filter(
        outflow =>
          outflow.data &&
          accounts
            .map(account => account.toString())
            .includes(outflow.data?.to.toAddress().toString()),
      )
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
          includedIn: block.hash.toString(),
        }
        logger.info(
          `core/block-processor - found withdrawal: ${withdrawalSql.hash}`,
        )
        db.upsert('Withdrawal', {
          where: { hash: withdrawalSql.hash },
          create: withdrawalSql,
          update: withdrawalSql,
        })
      }
    }
  }

  private async makePatch(parent: Header, block: Block): Promise<Patch> {
    logger.trace(`core/block-processor - BlockProcessor::makePatch()`)
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
    logger.trace(`core/block-processor - BlockProcessor::applyPatch()`)
    const { block, treePatch, massDeposits } = patch
    await BlockProcessor.markUsedUtxosAsNullified(
      patch.treePatch.nullifiers,
      block,
      db,
    )
    // Update mass deposits inclusion status
    if (massDeposits) {
      await this.markMassDepositsAsIncludedIn(massDeposits, block, db)
    }
    await BlockProcessor.markNewUtxosAsUnspent(
      (patch.treePatch?.utxos || []).map(utxo => utxo.hash),
      db,
    )
    await BlockProcessor.markNewWithdrawalsAsUnfinalized(
      (patch.treePatch?.withdrawals || []).map(withdrawal => {
        assert(withdrawal.noteHash)
        return withdrawal.noteHash
      }),
      db,
    )
    // Apply tree patch
    if (!this.activeFastSync) {
      await this.layer2.grove.applyGrovePatch(treePatch, db)
    }
    await this.updateMyUtxos(this.tracker.transferTrackers, patch, db)
    await this.updateMyWithdrawals(this.tracker.withdrawalTrackers, patch, db)
  }

  private async markMassDepositsAsIncludedIn(
    massDepositHashes: Bytes32[],
    block: Bytes32,
    db: TransactionDB,
  ) {
    logger.trace(
      `core/block-processor - BlockProcessor::markMassDepositsAsIncludedIn()`,
    )
    const nonIncluded = await this.db.findMany('MassDeposit', {
      where: {
        includedIn: null,
      },
    })
    const candidates: { [index: string]: MassDepositSql } = {}
    nonIncluded.forEach(md => {
      candidates[md.index] = md
    })
    const sortedCandidateKeys = Object.keys(candidates).sort()

    // TODO need batch query
    const indexes: string[] = []
    for (const hash of massDepositHashes) {
      for (const index of sortedCandidateKeys) {
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
          break
        }
      }
    }
    if (indexes.length === 0) return
    db.update('MassDeposit', {
      where: { index: indexes },
      update: { includedIn: block.toString() },
    })
    const deposits = await this.layer2.getDeposits(
      ...indexes.map(index => ({
        merged: Bytes32.from(candidates[index].merged),
        fee: Uint256.from(candidates[index].fee),
      })),
    )
    db.update('Deposit', {
      where: {
        note: deposits.map(deposit => deposit.note),
      },
      update: {
        includedIn: block.toString(),
      },
    })
  }

  private static async markUsedUtxosAsNullified(
    nullifiers: Fp[],
    block: Bytes32,
    db: TransactionDB,
  ) {
    logger.trace(
      `core/block-processor - BlockProcessor::markUsedUtxosAsNullified()`,
    )
    db.update('Utxo', {
      where: { nullifier: nullifiers.map(v => v.toString()) },
      update: {
        status: UtxoStatus.SPENT,
        usedAt: block.toString(),
      },
    })
  }

  private static async markNewUtxosAsUnspent(utxos: Fp[], db: TransactionDB) {
    logger.trace(
      `core/block-processor - BlockProcessor::markNewUtxosAsUnspent()`,
    )
    db.update('Utxo', {
      where: {
        hash: utxos.map(utxo => utxo.toUint256().toString()),
      },
      update: { status: UtxoStatus.UNSPENT },
    })
  }

  private static async markNewWithdrawalsAsUnfinalized(
    withdrawalNoteHashes: Fp[],
    db: TransactionDB,
  ) {
    logger.trace(
      `core/block-processor - BlockProcessor::markNewWithdrawalsAsUnfinalized()`,
    )
    db.update('Withdrawal', {
      where: {
        hash: withdrawalNoteHashes.map(noteHash => noteHash.toString()),
      },
      update: { status: WithdrawalStatus.UNFINALIZED },
    })
  }

  private async updateMyUtxos(
    accounts: ZkViewer[],
    patch: Patch,
    db: TransactionDB,
  ) {
    logger.trace(`core/block-processor - BlockProcessor::updateMyUtxos()`)
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
    logger.trace(`core/block-processor - BlockProcessor::updateMyWithdrawals()`)
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
      const { hash } = patch.treePatch.withdrawals[orderInArr]
      if (!hash) throw Error('Withdrawal does not have note hash')
      const merkleProof = await this.layer2.grove.withdrawalMerkleProof(
        hash,
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
