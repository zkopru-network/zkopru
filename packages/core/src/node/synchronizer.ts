/* eslint-disable @typescript-eslint/camelcase, no-underscore-dangle */
import assert from 'assert'
import { logger, Worker } from '@zkopru/utils'
import { TypedEvent, TypedListener } from '@zkopru/contracts/typechain/common'
import {
  DB,
  Header as HeaderSql,
  Deposit as DepositSql,
  Utxo as UtxoSql,
  MassDeposit as MassDepositSql,
  BlockCache,
} from '@zkopru/database'
import { Bytes32, Address, Uint256 } from 'soltypes'
import { ZkAddress } from '@zkopru/transaction'
import { BigNumber } from 'ethers'
import { L1Contract } from '../context/layer1'
import { Block, headerHash } from '../block'
import { genesis } from '../block/genesis'
import { EventProcessor } from './event-processor'

export enum NetworkStatus {
  STOPPED = 'stopped',
  ON_SYNCING = 'on syncing',
  ON_FETCHED = 'onFetched',
  ON_PROCESSING = 'processing',
  SYNCED = 'synced',
  FULLY_SYNCED = 'fully synced',
  ON_ERROR = 'on error',
}

export class Synchronizer extends EventProcessor {
  db: DB

  blockCache: BlockCache

  l1Contract!: L1Contract

  accounts?: ZkAddress[]

  erc20RegistrationSubscriber?: TypedListener<
    [string],
    {
      tokenAddr: string
    }
  >

  erc721RegistrationSubscriber?: TypedListener<
    [string],
    {
      tokenAddr: string
    }
  >

  depositSubscriber?: TypedListener<
    [BigNumber, BigNumber, BigNumber],
    {
      queuedAt: BigNumber
      note: BigNumber
      fee: BigNumber
    }
  >

  depositUtxoSubscribers: {
    [account: string]:
      | TypedListener<
          [
            BigNumber,
            BigNumber,
            BigNumber,
            string,
            BigNumber,
            BigNumber,
            BigNumber,
          ],
          {
            spendingPubKey: BigNumber
            salt: BigNumber
            eth: BigNumber
            token: string
            amount: BigNumber
            nft: BigNumber
            fee: BigNumber
          }
        >
      | undefined
  } = {}

  massDepositSubscriber?: TypedListener<
    [BigNumber, string, BigNumber],
    {
      index: BigNumber
      merged: string
      fee: BigNumber
    }
  >

  newProposalSubscriber?: TypedListener<
    [BigNumber, string],
    {
      proposalNum: BigNumber
      blockHash: string
    }
  >

  slashSubscriber?: TypedListener<
    [string, string, string],
    {
      blockHash: string
      proposer: string
      reason: string
    }
  >

  finalizationSubscriber?: TypedListener<
    [string],
    {
      blockHash: string
    }
  >

  isListening: boolean

  latestProcessed?: number

  status: NetworkStatus

  workers: {
    statusUpdater: Worker<void>
    blockFetcher: Worker<void>
  }

  fetching: {
    [proposalTx: string]: boolean
  }

  _genesisPromise: undefined | Promise<void>

  constructor(db: DB, l1Contract: L1Contract, blockCache: BlockCache) {
    super(l1Contract.provider)
    logger.trace(
      `core/synchronizer - Synchronizer::constructor(${l1Contract.address})`,
    )
    this.db = db
    this.blockCache = blockCache
    this.l1Contract = l1Contract
    this.isListening = false
    this.fetching = {}
    this.status = NetworkStatus.STOPPED
    this.workers = {
      statusUpdater: new Worker<void>(),
      blockFetcher: new Worker<void>(),
    }
  }

  sync(
    accounts?: ZkAddress[],
    proposalCB?: (hash: string) => void,
    finalizationCB?: (hash: string) => void,
  ) {
    logger.trace(
      `core/synchronizer - Synchronizer::sync(${accounts?.map(acc =>
        acc.toString(),
      )})`,
    )
    this.setStatus(NetworkStatus.ON_SYNCING)
    this.loadGenesis()
    if (!this.isListening) {
      const errHandler = (method: string) => (err: Error) => {
        logger.error(`core/synchronizer - error at ${method} ${err.toString()}`)
      }
      this.listenTokenRegistry().catch(errHandler('listenTokenRegistry'))
      this.listenDeposits().catch(errHandler('listenDeposits'))
      this.listenSlash().catch(errHandler('listenSlash'))
      this.listenMassDepositCommit().catch(errHandler('listenDepositCommit'))
      this.listenNewProposals(proposalCB).catch(
        errHandler('listenNewProposals'),
      )
      this.listenFinalization(finalizationCB).catch(
        errHandler('listenFinalization'),
      )
      if (accounts) {
        accounts.forEach(account => this.listenDepositUtxos(account))
        this.accounts = accounts
      }
      this.isListening = true
    }
    this.workers.statusUpdater.start({
      task: this.updateStatus.bind(this),
      interval: 5000,
    })
    this.workers.blockFetcher.start({
      task: this.fetchUnfetchedProposals.bind(this),
      interval: 5000,
    })
  }

  async stop() {
    logger.trace(`core/synchronizer - Synchronizer::stop()`)
    this.setStatus(NetworkStatus.STOPPED)
    this.isListening = false
    if (this.erc20RegistrationSubscriber) {
      this.l1Contract.coordinator.off(
        this.l1Contract.coordinator.filters.NewErc20(),
        this.erc20RegistrationSubscriber,
      )
      this.erc20RegistrationSubscriber = undefined
    }
    if (this.erc721RegistrationSubscriber) {
      this.l1Contract.coordinator.off(
        this.l1Contract.coordinator.filters.NewErc721(),
        this.erc721RegistrationSubscriber,
      )
      this.erc721RegistrationSubscriber = undefined
    }
    if (this.depositSubscriber) {
      this.l1Contract.user.off(
        this.l1Contract.user.filters.Deposit(),
        this.depositSubscriber,
      )
      this.depositSubscriber = undefined
    }
    if (this.accounts) {
      for (const account of this.accounts) {
        const subscriber = this.depositUtxoSubscribers[account.toString()]
        if (subscriber) {
          const filter = this.l1Contract.user.filters.DepositUtxo(
            account.spendingPubKey().toBigNumber(),
          )
          this.l1Contract.user.off(filter, subscriber)
          this.depositUtxoSubscribers[account.toString()] = undefined
        }
      }
    }
    if (this.massDepositSubscriber) {
      this.l1Contract.coordinator.off(
        this.l1Contract.coordinator.filters.MassDepositCommit(),
        this.massDepositSubscriber,
      )
      this.massDepositSubscriber = undefined
    }
    if (this.newProposalSubscriber) {
      this.l1Contract.coordinator.off(
        this.l1Contract.coordinator.filters.NewProposal(),
        this.newProposalSubscriber,
      )
      this.newProposalSubscriber = undefined
    }
    if (this.slashSubscriber) {
      this.l1Contract.challenger.off(
        this.l1Contract.challenger.filters.Slash(),
        this.slashSubscriber,
      )
      this.slashSubscriber = undefined
    }
    if (this.finalizationSubscriber) {
      this.l1Contract.coordinator.off(
        this.l1Contract.coordinator.filters.Finalized(),
        this.finalizationSubscriber,
      )
      this.finalizationSubscriber = undefined
    }
    await Promise.all([
      this.workers.statusUpdater.close(),
      this.workers.blockFetcher.close(),
    ])
  }

  isSynced(): boolean {
    return this.status === NetworkStatus.FULLY_SYNCED
  }

  async updateStatus() {
    logger.trace(`core/synchronizer - Synchronizer::updateStatus()`)
    const unfetched = await this.db.findOne('Proposal', {
      where: {
        proposalData: null,
      },
      orderBy: {
        proposalNum: 'desc',
      },
    })
    const unprocessed = await this.db.findOne('Proposal', {
      where: {
        verified: null,
        isUncle: null,
      },
      orderBy: {
        proposalNum: 'desc',
      },
    })
    const haveFetchedAll = !unfetched
    const haveProcessedAll = !unprocessed
    if (!haveFetchedAll) {
      this.setStatus(NetworkStatus.ON_SYNCING)
    } else if (!haveProcessedAll) {
      this.setStatus(NetworkStatus.ON_PROCESSING)
    } else {
      const layer1ProposedBlocks = (
        await this.l1Contract.zkopru.proposedBlocks()
      ).sub(1) // proposal num starts from 0
      if (layer1ProposedBlocks.eq(this.latestProcessed || 0)) {
        this.setStatus(NetworkStatus.FULLY_SYNCED)
      } else if (layer1ProposedBlocks.lt((this.latestProcessed || 0) + 2)) {
        this.setStatus(NetworkStatus.SYNCED)
      } else {
        this.setStatus(NetworkStatus.ON_SYNCING)
      }
    }
  }

  setLatestProcessed(proposalNum: number) {
    logger.trace(
      `core/synchronizer - Synchronizer::setLatestProcessed(${proposalNum})`,
    )
    if ((this.latestProcessed || 0) < proposalNum) {
      this.latestProcessed = proposalNum
      this.l1Contract.zkopru.proposedBlocks().then(num => {
        const layer1ProposedBlocks = Uint256.from(num.toString())
          .toBigNumber()
          .sub(1) // proposal num starts from 0
          .toString()
        logger.info(
          `core/synchronizer- processed ${proposalNum}/${layer1ProposedBlocks}`,
        )
      })
    }
  }

  private setStatus(status: NetworkStatus) {
    if (this.status !== status) {
      this.status = status
      // this.emit('status', status, this.latestProposedHash)
      logger.info(`core/synchronizer - Sync status: ${status}`)
      this.emit('status', status)
    }
  }

  async loadGenesis() {
    this._genesisPromise = this._loadGenesis().catch(err => {
      this._genesisPromise = undefined
      logger.error(`core/synchronizer - loadGenesis(): ${err.toString()}`)
      throw err
    })
    return this._genesisPromise
  }

  async loadGenesisIfNeeded() {
    if (this._genesisPromise) return this._genesisPromise
    return this.loadGenesis()
  }

  private async _loadGenesis() {
    logger.trace(`core/synchronizer - Synchronizer::loadGenesis()`)
    const numOfGenesisBlock = await this.db.count('Proposal', {
      proposalNum: 0,
    })
    if (numOfGenesisBlock > 0) {
      return
    }
    const ingestEvent = async (
      event: TypedEvent<
        [string, string, BigNumber, string] & {
          blockHash: string
          proposer: string
          fromBlock: BigNumber
          parentBlock: string
        }
      >,
      onComplete?: () => void,
    ) => {
      const { args, blockNumber, transactionHash } = event
      const { timestamp } = await this.l1Contract.provider.getBlock(blockNumber)
      // WRITE DATABASE
      const { blockHash, proposer, parentBlock } = args
      logger.info(
        `core/synchronizer - Genesis block ${blockHash} is proposed by ${proposer}`,
      )
      // GENESIS BLOCK
      const config = await this.l1Contract.getConfig()
      const genesisHeader = genesis({
        address: Address.from(proposer),
        parent: Bytes32.from(parentBlock),
        config,
      })
      if (!Bytes32.from(blockHash).eq(headerHash(genesisHeader))) {
        throw Error('Failed to set up the genesis block')
      }
      const header: HeaderSql = {
        hash: blockHash,
        proposer: genesisHeader.proposer.toString(),
        parentBlock: genesisHeader.parentBlock.toString(),
        fee: genesisHeader.fee.toString(),
        utxoRoot: genesisHeader.utxoRoot.toString(),
        utxoIndex: genesisHeader.utxoIndex.toString(),
        nullifierRoot: genesisHeader.nullifierRoot.toString(),
        withdrawalRoot: genesisHeader.withdrawalRoot.toString(),
        withdrawalIndex: genesisHeader.withdrawalIndex.toString(),
        txRoot: genesisHeader.txRoot.toString(),
        depositRoot: genesisHeader.depositRoot.toString(),
        migrationRoot: genesisHeader.migrationRoot.toString(),
      }
      await this.blockCache.transactionCache(
        db => {
          db.upsert('Proposal', {
            where: {
              hash: blockHash,
            },
            update: {},
            create: {
              hash: blockHash,
              proposalNum: 0,
              canonicalNum: 0,
              proposedAt: blockNumber,
              proposalTx: transactionHash,
              finalized: true,
              verified: true,
              proposalData: '',
              timestamp,
            },
          })
          db.upsert('Block', {
            where: {
              hash: blockHash,
            },
            update: {},
            create: {
              hash: blockHash,
            },
          })
          db.upsert('Header', {
            where: {
              hash: header.hash,
            },
            update: {},
            create: header,
          })
        },
        blockNumber,
        event.blockHash,
        onComplete,
      )
    }
    logger.info('core/synchronizer - No genesis block. Trying to fetch')
    const filterResult = await this.l1Contract.zkopru.queryFilter(
      this.l1Contract.zkopru.filters.GenesisBlock(),
    )
    if (filterResult.length > 1) {
      throw new Error('Got multiple genesis events')
    } else if (filterResult.length === 1) {
      await ingestEvent(filterResult[0])
      return
    }
    // otherwise wait for the event to be emitted
    const wait = await new Promise<void>(rs => {
      this.l1Contract.zkopru.once(
        this.l1Contract.zkopru.filters.GenesisBlock(),
        (...[, , , , data]) => {
          ingestEvent(data, rs)
        },
      )
    })
    return wait
  }

  async listenTokenRegistry() {
    logger.trace(`core/synchronizer - Synchronizer::listenTokenRegistry()`)
    await this.loadGenesisIfNeeded()
    const { proposedAt } = await this.db.findOne('Proposal', {
      where: {
        proposalNum: 0,
      },
    })
    const lastRegistration = await this.db.findMany('TokenRegistry', {
      where: {},
      orderBy: { blockNumber: 'desc' },
      limit: 1,
    })
    const pivotBlock = await this.l1Contract.provider.getBlockNumber()
    const fromBlock = lastRegistration[0]?.blockNumber || proposedAt
    const SCAN_LENGTH = 1000
    let currentBlock = fromBlock
    const erc20ListnerFilter = this.l1Contract.coordinator.filters.NewErc20()
    const erc721ListnerFilter = this.l1Contract.coordinator.filters.NewErc721()
    while (currentBlock < pivotBlock && this.isListening) {
      const start = currentBlock
      const end = Math.min(currentBlock + SCAN_LENGTH - 1, pivotBlock)
      {
        const events = await this.l1Contract.coordinator.queryFilter(
          erc20ListnerFilter,
          start,
          end,
        )
        if (events.length > 0) {
          await this.db.transaction(db => {
            this.handleNewErc20Events(events, db)
          })
        }
      }
      {
        const events = await this.l1Contract.coordinator.queryFilter(
          erc721ListnerFilter,
          start,
          end,
        )
        if (events.length > 0) {
          await this.db.transaction(db => {
            this.handleNewErc721Events(events, db)
          })
        }
      }
      currentBlock = end + 1
    }
    if (this.isListening) {
      if (!this.erc20RegistrationSubscriber) {
        this.erc20RegistrationSubscriber = async (...args) => {
          const typedEvent = args[1]
          const { blockNumber, blockHash } = typedEvent
          await this.blockCache.transactionCache(
            db => {
              this.handleNewErc20Events([typedEvent], db)
            },
            blockNumber,
            blockHash,
          )
        }
        this.l1Contract.coordinator.on(
          erc20ListnerFilter,
          this.erc20RegistrationSubscriber,
        )
        this.erc20RegistrationSubscriber = this.erc20RegistrationSubscriber
      }
      if (!this.erc721RegistrationSubscriber) {
        this.erc721RegistrationSubscriber = async (...args) => {
          const typedEvent = args[1]
          const { blockNumber, blockHash } = typedEvent
          await this.blockCache.transactionCache(
            db => {
              this.handleNewErc721Events([typedEvent], db)
            },
            blockNumber,
            blockHash,
          )
        }
        this.l1Contract.coordinator.on(
          erc721ListnerFilter,
          this.erc721RegistrationSubscriber,
        )
      }
    }
  }

  async listenDeposits(cb?: (deposit: DepositSql) => void) {
    logger.trace(`core/synchronizer - Synchronizer::listenDeposits()`)
    await this.loadGenesisIfNeeded()
    const { proposedAt } = await this.db.findOne('Proposal', {
      where: {
        proposalNum: 0,
      },
    })
    const lastDeposits = await this.db.findMany('Deposit', {
      where: {},
      orderBy: { blockNumber: 'desc' },
      limit: 1,
    })
    const fromBlock = lastDeposits[0]?.blockNumber || proposedAt
    logger.info(
      `core/synchronizer - Scan deposit hashes from block number ${fromBlock}`,
    )
    const pivotBlock =
      (await this.l1Contract.provider.getBlockNumber()) -
      this.blockCache.BLOCK_CONFIRMATIONS
    const SCAN_LENGTH = 1000
    let currentBlock = fromBlock
    while (currentBlock < pivotBlock && this.isListening) {
      const start = currentBlock
      const end = Math.min(currentBlock + SCAN_LENGTH - 1, pivotBlock)
      const depositFilter = this.l1Contract.user.filters.Deposit()
      const events = await this.l1Contract.user.queryFilter(
        depositFilter,
        start,
        end,
      )
      if (events.length > 0) {
        await this.db.transaction(db => {
          this.handleDepositEvents(events, db, cb)
        })
      }
      currentBlock = end + 1
    }
    const depositFilter = this.l1Contract.user.filters.Deposit()
    if (this.isListening && !this.depositSubscriber) {
      logger.info(`core/synchronizer - Listening Deposit events`)
      this.depositSubscriber = async (...event) => {
        const typedEvent = event[3]
        const { blockNumber, blockHash } = typedEvent
        logger.info(
          `core/synchronizer - NewDeposit(${typedEvent.args.note.toString()})`,
        )
        await this.blockCache.transactionCache(
          db => {
            this.handleDepositEvents([typedEvent], db, cb)
          },
          blockNumber,
          blockHash,
        )
      }
      this.l1Contract.user.on(depositFilter, this.depositSubscriber)
    }
  }

  async listenDepositUtxos(account: ZkAddress, cb?: (utxo: UtxoSql) => void) {
    await this.loadGenesisIfNeeded()
    const { proposedAt } = await this.db.findOne('Proposal', {
      where: {
        proposalNum: 0,
      },
    })
    logger.trace(`core/synchronizer - Synchronizer::listenDepositUtxos()`)
    const lastDeposits = await this.db.findMany('Utxo', {
      where: {},
      orderBy: { depositedAt: 'desc' },
      limit: 1,
    })
    const fromBlock = (lastDeposits[0]?.blockNumber ||
      proposedAt ||
      0) as number
    logger.info(
      `core/synchronizer - Scan deposit details from block number ${fromBlock}`,
    )
    const pivotBlock =
      (await this.l1Contract.provider.getBlockNumber()) -
      this.blockCache.BLOCK_CONFIRMATIONS
    const SCAN_LENGTH = 1000
    let currentBlock = fromBlock
    const depositUtxoFilter = this.l1Contract.user.filters.DepositUtxo(
      account.spendingPubKey().toBigNumber(),
    )
    while (currentBlock < pivotBlock && this.isListening) {
      const start = currentBlock
      const end = Math.min(currentBlock + SCAN_LENGTH - 1, pivotBlock)
      const events = await this.l1Contract.user.queryFilter(
        depositUtxoFilter,
        start,
        end,
      )
      if (events.length > 0) {
        await this.db.transaction(db => {
          this.handleDepositUtxoEvents(events, account, db, cb)
        })
      }
      currentBlock = end + 1
    }
    if (this.isListening && !this.depositUtxoSubscribers[account.toString()]) {
      const subscriber = async (...[, , , , , , , typedEvent]) => {
        await this.blockCache.transactionCache(
          db => {
            this.handleDepositUtxoEvents([typedEvent], account, db, cb)
          },
          typedEvent.blockNumber,
          typedEvent.blockHash,
        )
      }
      this.depositUtxoSubscribers[account.toString()] = subscriber
      this.l1Contract.user.on(depositUtxoFilter, subscriber)
    }
  }

  async listenMassDepositCommit(cb?: (commit: MassDepositSql) => void) {
    logger.trace(`core/synchronizer - Synchronizer::listenMassDepositCommit()`)
    await this.loadGenesisIfNeeded()
    const { proposedAt } = await this.db.findOne('Proposal', {
      where: {
        proposalNum: 0,
      },
    })
    const lastMassDeposit = await this.db.findMany('MassDeposit', {
      where: {},
      orderBy: { blockNumber: 'desc' },
      limit: 1,
    })
    const fromBlock = lastMassDeposit[0]?.blockNumber || proposedAt
    const pivotBlock =
      (await this.l1Contract.provider.getBlockNumber()) -
      this.blockCache.BLOCK_CONFIRMATIONS
    const SCAN_LENGTH = 1000
    let currentBlock = fromBlock
    const massDepositCommitFilter = this.l1Contract.coordinator.filters.MassDepositCommit()
    while (currentBlock < pivotBlock && this.isListening) {
      const start = currentBlock
      const end = Math.min(currentBlock + SCAN_LENGTH - 1, pivotBlock)
      const events = await this.l1Contract.coordinator.queryFilter(
        massDepositCommitFilter,
        start,
        end,
      )
      if (events.length > 0) {
        await this.db.transaction(db => {
          this.handleMassDepositCommitEvents(events, db, cb)
        })
      }
      currentBlock = end + 1
    }
    logger.info(
      `core/synchronizer - Scan mass deposits from block number ${fromBlock}`,
    )
    if (this.isListening && !this.massDepositSubscriber) {
      this.massDepositSubscriber = async (...events) => {
        const typedEvent = events[3]
        const { args } = typedEvent
        logger.info(
          `core/synchronizer - Total fee for MassDepositCommit #${args.index}(${args.merged}) is ${args.fee} gwei`,
        )
        await this.blockCache.transactionCache(
          db => {
            this.handleMassDepositCommitEvents([typedEvent], db, cb)
          },
          typedEvent.blockNumber,
          typedEvent.blockHash,
        )
      }
      this.l1Contract.coordinator.on(
        massDepositCommitFilter,
        this.massDepositSubscriber,
      )
    }
  }

  async listenNewProposals(cb?: (hash: string) => void) {
    logger.trace(`core/synchronizer - Synchronizer::listenNewProposals()`)
    await this.loadGenesisIfNeeded()
    const { proposedAt } = await this.db.findOne('Proposal', {
      where: {
        proposalNum: 0,
      },
    })
    const lastProposal = await this.db.findMany('Proposal', {
      where: {},
      orderBy: { proposedAt: 'desc' },
      limit: 1,
    })
    const fromBlock = lastProposal[0]?.proposedAt || proposedAt
    const pivotBlock =
      (await this.l1Contract.provider.getBlockNumber()) -
      this.blockCache.BLOCK_CONFIRMATIONS
    const SCAN_LENGTH = 1000
    let currentBlock = fromBlock
    const newProposalFilter = this.l1Contract.coordinator.filters.NewProposal()
    while (currentBlock < pivotBlock && this.isListening) {
      const start = currentBlock
      const end = Math.min(currentBlock + SCAN_LENGTH - 1, pivotBlock)
      const events = await this.l1Contract.coordinator.queryFilter(
        newProposalFilter,
        start,
        end,
      )
      if (events.length > 0) {
        await this.db.transaction(db => {
          this.handleNewProposalEvents(events, db, cb)
        })
      }
      currentBlock = end + 1
    }
    logger.info(
      `core/synchronizer - Scan new proposals from block number ${fromBlock}`,
    )
    if (this.isListening && !this.newProposalSubscriber) {
      this.newProposalSubscriber = async (...data) => {
        const event = data[2]
        const { args, blockNumber } = event
        // WRITE DATABASE
        const { proposalNum, blockHash } = args
        logger.info(
          `core/synchronizer - NewProposal: #${proposalNum}(${blockHash}) @ L1 #${blockNumber}`,
        )
        await this.blockCache.transactionCache(
          db => {
            this.handleNewProposalEvents([event], db, cb)
          },
          event.blockNumber,
          event.blockHash,
        )
      }
      this.l1Contract.coordinator.on(
        newProposalFilter,
        this.newProposalSubscriber,
      )
    }
  }

  async listenSlash(cb?: (hash: string) => void) {
    logger.trace(`core/synchronizer - Synchronizer::listenSlash()`)
    await this.loadGenesisIfNeeded()
    const { proposedAt } = await this.db.findOne('Proposal', {
      where: {
        proposalNum: 0,
      },
    })
    const lastSlash = await this.db.findMany('Slash', {
      where: {},
      orderBy: { slashedAt: 'desc' },
      limit: 1,
    })
    const fromBlock = lastSlash[0]?.slashedAt || proposedAt
    const pivotBlock =
      (await this.l1Contract.provider.getBlockNumber()) -
      this.blockCache.BLOCK_CONFIRMATIONS
    const SCAN_LENGTH = 1000
    let currentBlock = fromBlock
    const slashFilter = this.l1Contract.challenger.filters.Slash()
    while (currentBlock < pivotBlock && this.isListening) {
      const start = currentBlock
      const end = Math.min(currentBlock + SCAN_LENGTH - 1, pivotBlock)
      const events = await this.l1Contract.challenger.queryFilter(
        slashFilter,
        start,
        end,
      )
      if (events.length > 0) {
        await this.db.transaction(db => {
          this.handleSlashEvent(events, db, cb)
        })
      }
      currentBlock = end + 1
    }
    if (this.isListening && !this.slashSubscriber) {
      this.slashSubscriber = async (...data) => {
        const event = data[3]
        logger.info(
          `core/synchronizer - Found a slashed block: ${event.args.blockHash}`,
        )
        await this.blockCache.transactionCache(
          db => {
            this.handleSlashEvent([event], db, cb)
          },
          event.blockNumber,
          event.blockHash,
        )
      }
      this.l1Contract.challenger.on(slashFilter, this.slashSubscriber)
    }
  }

  async listenFinalization(cb?: (hash: string) => void) {
    logger.trace(`core/synchronizer - Synchronizer::listenFinalization()`)
    await this.loadGenesisIfNeeded()
    const { proposedAt } = await this.db.findOne('Proposal', {
      where: {
        proposalNum: 0,
      },
    })
    const lastFinalized = await this.db.findOne('Proposal', {
      where: { finalized: true },
      orderBy: { proposedAt: 'desc' },
    })
    const fromBlock = lastFinalized?.proposedAt || proposedAt
    const pivotBlock =
      (await this.l1Contract.provider.getBlockNumber()) -
      this.blockCache.BLOCK_CONFIRMATIONS
    const SCAN_LENGTH = 1000
    let currentBlock = fromBlock
    const fianlizedFilter = this.l1Contract.coordinator.filters.Finalized()
    while (currentBlock < pivotBlock && this.isListening) {
      const start = currentBlock
      const end = Math.min(currentBlock + SCAN_LENGTH - 1, pivotBlock)
      const events = await this.l1Contract.coordinator.queryFilter(
        fianlizedFilter,
        start,
        end,
      )
      if (events.length > 0) {
        await this.db.transaction(db => {
          this.handleFinalizationEvents(events, db, cb)
        })
      }
      currentBlock = end + 1
    }
    if (this.isListening && !this.finalizationSubscriber) {
      this.finalizationSubscriber = async (...data) => {
        const event = data[1]
        const hash = event.args.blockHash
        logger.info(`core/synchronizer - Finalized ${hash}`)
        await this.blockCache.transactionCache(
          db => {
            this.handleFinalizationEvents([event], db, cb)
          },
          event.blockNumber,
          event.blockHash,
        )
      }
      this.l1Contract.coordinator.on(
        fianlizedFilter,
        this.finalizationSubscriber,
      )
    }
  }

  async fetchUnfetchedProposals() {
    logger.trace(`core/synchronizer - Synchronizer::fetchUnfetchedProposals()`)
    const MAX_FETCH_JOB = 20
    const availableFetchJob = Math.max(
      MAX_FETCH_JOB - Object.keys(this.fetching).length,
      0,
    )
    if (availableFetchJob === 0) return
    const candidates = await this.db.findMany('Proposal', {
      where: {
        proposalData: null,
        proposalTx: { ne: null },
      },
      orderBy: {
        proposalNum: 'asc',
      },
      limit: availableFetchJob,
    })

    candidates.forEach(candidate => {
      assert(candidate.proposalTx)
      this.fetch(candidate.proposalTx)
    })
  }

  async fetch(proposalTx: string) {
    logger.trace(`core/synchronizer - Synchronizer::fetch()`)
    if (this.fetching[proposalTx]) return
    const proposalData = await this.l1Contract.provider.getTransaction(
      proposalTx,
    )
    if (!proposalData.blockHash) {
      return
    }
    const { timestamp } = await this.l1Contract.provider.getBlock(
      proposalData.blockHash,
    )
    this.fetching[proposalTx] = true
    const block = Block.fromTx(proposalData)
    logger.info(
      `core/synchronizer - Fetched tx ${proposalTx} for block ${block.hash.toString()}`,
    )
    const header = block.getHeaderSql()
    try {
      await this.db.transaction(db => {
        db.upsert('Block', {
          where: { hash: header.hash },
          create: { hash: header.hash },
          update: {},
        })
        db.upsert('Header', {
          where: { hash: header.hash },
          create: header,
          update: header,
        })
        db.update('Proposal', {
          where: { hash: header.hash },
          update: {
            proposalData: JSON.stringify(proposalData),
            timestamp,
          },
        })
      })
    } catch (err) {
      logger.error(err as any)
      process.exit()
    }
    this.emit(NetworkStatus.ON_FETCHED, block)
    delete this.fetching[proposalTx]
  }
}
