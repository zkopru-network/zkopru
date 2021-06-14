/* eslint-disable @typescript-eslint/camelcase */
import assert from 'assert'
import { logger, Worker } from '@zkopru/utils'
import {
  DB,
  Header as HeaderSql,
  Deposit as DepositSql,
  MassDeposit as MassDepositSql,
  TokenRegistry as TokenRegistrySql,
  BlockCache,
} from '@zkopru/database'
import { EventEmitter } from 'events'
import { Bytes32, Address, Uint256 } from 'soltypes'
import { L1Contract } from '../context/layer1'
import { Block, headerHash } from '../block'
import { genesis } from '../block/genesis'

export enum NetworkStatus {
  STOPPED = 'stopped',
  ON_SYNCING = 'on syncing',
  ON_FETCHED = 'onFetched',
  ON_PROCESSING = 'processing',
  SYNCED = 'synced',
  FULLY_SYNCED = 'fully synced',
  ON_ERROR = 'on error',
}

export class Synchronizer extends EventEmitter {
  db: DB

  blockCache: BlockCache

  l1Contract!: L1Contract

  depositSubscriber?: EventEmitter

  massDepositCommitSubscriber?: EventEmitter

  proposalSubscriber?: EventEmitter

  slashSubscriber?: EventEmitter

  finalizationSubscriber?: EventEmitter

  erc20RegistrationSubscriber?: EventEmitter

  erc721RegistrationSubscriber?: EventEmitter

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

  constructor(db: DB, l1Contract: L1Contract, blockCache: BlockCache) {
    super()
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
    proposalCB?: (hash: string) => void,
    finalizationCB?: (hash: string) => void,
  ) {
    this.setStatus(NetworkStatus.ON_SYNCING)
    if (!this.isListening) {
      this.listenGenesis()
      this.listenTokenRegistry()
      this.listenDeposits()
      this.listenSlash()
      this.listenMassDepositCommit()
      this.listenNewProposals(proposalCB)
      this.listenFinalization(finalizationCB)
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
    this.setStatus(NetworkStatus.STOPPED)
    const subscribers = [
      this.proposalSubscriber,
      this.slashSubscriber,
      this.erc20RegistrationSubscriber,
      this.erc721RegistrationSubscriber,
      this.depositSubscriber,
      this.massDepositCommitSubscriber,
      this.finalizationSubscriber,
    ]
    subscribers.forEach(subscriber => subscriber?.removeAllListeners())
    this.isListening = false
    await Promise.all([
      this.workers.statusUpdater.close(),
      this.workers.blockFetcher.close(),
    ])
  }

  isSynced(): boolean {
    return this.status === NetworkStatus.FULLY_SYNCED
  }

  async updateStatus() {
    const unfetched = await this.db.count('Proposal', {
      proposalData: null,
    })
    const unprocessed = await this.db.count('Proposal', {
      verified: null,
      isUncle: null,
    })
    const haveFetchedAll = unfetched === 0
    const haveProcessedAll = unprocessed === 0
    if (!haveFetchedAll) {
      this.setStatus(NetworkStatus.ON_SYNCING)
    } else if (!haveProcessedAll) {
      this.setStatus(NetworkStatus.ON_PROCESSING)
    } else {
      const layer1ProposedBlocks = Uint256.from(
        await this.l1Contract.upstream.methods.proposedBlocks().call(),
      )
        .toBN()
        .subn(1) // proposal num starts from 0
      logger.trace(`total proposed: ${layer1ProposedBlocks.toString(10)}`)
      logger.trace(`total processed: ${this.latestProcessed}`)
      if (layer1ProposedBlocks.eqn(this.latestProcessed || 0)) {
        this.setStatus(NetworkStatus.FULLY_SYNCED)
      } else if (layer1ProposedBlocks.ltn((this.latestProcessed || 0) + 2)) {
        this.setStatus(NetworkStatus.SYNCED)
      } else {
        this.setStatus(NetworkStatus.ON_SYNCING)
      }
    }
  }

  setLatestProcessed(proposalNum: number) {
    if ((this.latestProcessed || 0) < proposalNum) {
      logger.info(`Latest processed: ${proposalNum}`)
      this.latestProcessed = proposalNum
    }
  }

  private setStatus(status: NetworkStatus) {
    if (this.status !== status) {
      this.status = status
      // this.emit('status', status, this.latestProposedHash)
      logger.info(`sync status: ${status}`)
      this.emit('status', status)
    }
  }

  async listenGenesis() {
    const numOfGenesisBlock = await this.db.count('Proposal', {
      proposalNum: 0,
    })
    if (numOfGenesisBlock === 0) {
      logger.info('No genesis block. Trying to fetch')
      const genesisListener = this.l1Contract.upstream.events
        .GenesisBlock({ fromBlock: 0 })
        .on('data', async event => {
          const { returnValues, blockNumber, transactionHash } = event
          // WRITE DATABASE
          const { blockHash, proposer, parentBlock } = returnValues
          logger.info(`genesis hash: ${blockHash}`)
          logger.info(`genesis data: ${returnValues}`)

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

          await this.db.create('Proposal', {
            hash: blockHash,
            proposalNum: 0,
            canonicalNum: 0,
            proposedAt: blockNumber,
            proposalTx: transactionHash,
            finalized: true,
            verified: true,
            proposalData: '',
          })
          await this.db.create('Block', {
            hash: blockHash,
          })
          await this.db.create('Header', header)
          genesisListener.removeAllListeners()
        })
    }
  }

  async listenTokenRegistry() {
    const lastRegistration = await this.db.findMany('TokenRegistry', {
      where: {},
      orderBy: { blockNumber: 'desc' },
      limit: 1,
    })
    const fromBlock = lastRegistration[0]?.blockNumber || 0
    this.erc20RegistrationSubscriber = this.l1Contract.coordinator.events
      .NewErc20({ fromBlock })
      .on('data', async event => {
        const { returnValues, blockNumber } = event
        // WRITE DATABASE
        const { tokenAddr } = (returnValues as unknown) as { tokenAddr: string }
        logger.info(`ERC20 token registered: ${tokenAddr}`)
        const tokenRegistry: TokenRegistrySql = {
          address: tokenAddr,
          isERC20: true,
          isERC721: false,
          identifier: Address.from(tokenAddr)
            .toBN()
            .modn(256),
          blockNumber,
        }

        await this.db.upsert('TokenRegistry', {
          where: { address: tokenAddr },
          create: tokenRegistry,
          update: tokenRegistry,
        })
      })
    this.erc721RegistrationSubscriber = this.l1Contract.coordinator.events
      .NewErc721({ fromBlock })
      .on('data', async event => {
        const { returnValues, blockNumber } = event
        // WRITE DATABASE
        const { tokenAddr } = (returnValues as unknown) as { tokenAddr: string }
        logger.info(`ERC721 token registered: ${tokenAddr}`)
        const tokenRegistry: TokenRegistrySql = {
          address: tokenAddr,
          isERC20: false,
          isERC721: true,
          identifier: Address.from(tokenAddr)
            .toBN()
            .modn(256),
          blockNumber,
        }
        await this.db.upsert('TokenRegistry', {
          where: { address: tokenAddr },
          create: tokenRegistry,
          update: tokenRegistry,
        })
      })
  }

  async listenDeposits(cb?: (deposit: DepositSql) => void) {
    const lastDeposits = await this.db.findMany('Deposit', {
      where: {},
      orderBy: { blockNumber: 'desc' },
      limit: 1,
    })
    const fromBlock = lastDeposits[0]?.blockNumber || 0
    logger.info('new deposit from block', fromBlock)
    this.depositSubscriber = this.l1Contract.user.events
      .Deposit({ fromBlock })
      .on('connected', subId => {
        logger.info(
          `synchronizer.js: Deposit listener is connected. Id: ${subId}`,
        )
      })
      .on('data', async event => {
        const { returnValues, logIndex, transactionIndex, blockNumber } = event
        const deposit: DepositSql = {
          note: Uint256.from(returnValues.note).toString(),
          fee: Uint256.from(returnValues.fee).toString(),
          queuedAt: Uint256.from(returnValues.queuedAt).toString(),
          transactionIndex,
          logIndex,
          blockNumber,
        }
        logger.info(`synchronizer.js: NewDeposit(${deposit.note})`)
        await this.blockCache.upsertCache(
          'Deposit',
          {
            where: { note: deposit.note },
            update: deposit,
            create: deposit,
          },
          blockNumber,
          event.blockHash,
        )
        if (cb) cb(deposit)
      })
      .on('changed', event => {
        this.blockCache.clearChangesForBlockHash(event.blockHash)
        logger.info(`synchronizer.js: Deposit Event changed`, event)
      })
      .on('error', event => {
        // TODO
        logger.info(`synchronizer.js: Deposit Event Error occured`, event)
      })
  }

  async listenMassDepositCommit(cb?: (commit: MassDepositSql) => void) {
    const lastMassDeposit = await this.db.findMany('MassDeposit', {
      where: {},
      orderBy: { blockNumber: 'desc' },
      limit: 1,
    })
    const fromBlock = lastMassDeposit[0]?.blockNumber || 0
    logger.info('sync mass deposits from block', fromBlock)
    this.massDepositCommitSubscriber = this.l1Contract.coordinator.events
      .MassDepositCommit({ fromBlock })
      .on('connected', subId => {
        logger.info(
          `synchronizer.js: MassDepositCommit listener is connected. Id: ${subId}`,
        )
      })
      .on('data', async event => {
        const { returnValues, blockNumber } = event
        logger.info(
          `MassDepositCommit
          ${returnValues.index}
          ${returnValues.merged}
          ${returnValues.fee}`,
        )
        const massDeposit: MassDepositSql = {
          index: Uint256.from(returnValues.index).toString(),
          merged: Bytes32.from(returnValues.merged).toString(),
          fee: Uint256.from(returnValues.fee).toString(),
          blockNumber,
          includedIn: null,
        }
        logger.debug(
          `Massdeposit: index ${massDeposit.index} / merged: ${massDeposit.merged} / fee: ${massDeposit.fee}`,
        )
        logger.info('massdeposit commit is', massDeposit)
        await this.blockCache.upsertCache(
          'MassDeposit',
          {
            where: { index: massDeposit.index },
            create: massDeposit,
            update: {},
          },
          blockNumber,
          event.blockHash,
        )
        if (cb) cb(massDeposit)
        logger.info('massdeposit commit succeeded')
      })
      .on('changed', event => {
        this.blockCache.clearChangesForBlockHash(event.blockHash)
        logger.info(`synchronizer.js: MassDeposit Event changed`, event)
      })
      .on('error', event => {
        // TODO
        logger.info(`synchronizer.js: MassDeposit Event error changed`, event)
      })
  }

  async listenNewProposals(cb?: (hash: string) => void) {
    const lastProposal = await this.db.findMany('Proposal', {
      where: {},
      orderBy: { proposedAt: 'desc' },
      limit: 1,
    })
    const fromBlock = lastProposal[0]?.proposedAt || 0
    logger.info('listenNewProposal fromBlock: ', fromBlock)
    this.proposalSubscriber = this.l1Contract.coordinator.events
      .NewProposal({ fromBlock })
      .on('connected', subId => {
        logger.info(
          `synchronizer.js: NewProposal listener is connected. Id: ${subId}`,
        )
      })
      .on('data', async event => {
        const { returnValues, blockNumber, transactionHash } = event
        // WRITE DATABASE
        const { proposalNum, blockHash } = returnValues
        logger.info(
          `newProposal: ${proposalNum} - ${blockHash} @ ${blockNumber}`,
        )
        const newProposal = {
          hash: Bytes32.from(blockHash).toString(),
          proposalNum: parseInt(proposalNum, 10),
          proposedAt: blockNumber,
          proposalTx: transactionHash,
        }
        await this.blockCache.upsertCache(
          'Proposal',
          {
            where: { hash: newProposal.hash },
            create: newProposal,
            update: newProposal,
          },
          blockNumber,
          event.blockHash,
        )
        if (cb) cb(blockHash)
      })
      .on('changed', event => {
        this.blockCache.clearChangesForBlockHash(event.blockHash)
        logger.info(`synchronizer.js: NewProposal Event changed`, event)
      })
      .on('error', err => {
        // TODO
        logger.info(`synchronizer.js: NewProposal Event error occured`, err)
      })
  }

  async listenSlash(cb?: (hash: string) => void) {
    const lastSlash = await this.db.findMany('Slash', {
      where: {},
      orderBy: { slashedAt: 'desc' },
      limit: 1,
    })
    const fromBlock = lastSlash[0]?.slashedAt || 0
    this.slashSubscriber = this.l1Contract.challenger.events
      .Slash({ fromBlock })
      .on('connected', subId => {
        logger.info(
          `synchronizer.js: Slash listener is connected. Id: ${subId}`,
        )
      })
      .on('data', async event => {
        const { returnValues, blockNumber, transactionHash } = event
        const hash = Bytes32.from(returnValues.blockHash).toString()
        const proposer = Address.from(returnValues.proposer).toString()
        const { reason } = returnValues

        logger.debug(`slashed hash@!${hash}`)
        logger.debug(`${JSON.stringify(event.returnValues)}`)
        await this.blockCache.transactionCache(
          db => {
            db.upsert('Slash', {
              where: { hash },
              create: {
                proposer,
                reason,
                executionTx: transactionHash,
                slashedAt: blockNumber,
                hash,
              },
              update: {
                hash,
                proposer,
                reason,
                executionTx: transactionHash,
                slashedAt: blockNumber,
              },
            })
            db.update('Tx', {
              where: { blockHash: hash },
              update: { slashed: true },
            })
          },
          blockNumber,
          event.blockHash,
        )
        if (cb) cb(hash)
      })
      .on('changed', event => {
        this.blockCache.clearChangesForBlockHash(event.blockHash)
        logger.info(`synchronizer.js: Slash Event changed`, event)
      })
      .on('error', err => {
        // TODO removed
        logger.info(`synchronizer.js: Slash Event error occured`, err)
      })
  }

  async listenFinalization(cb?: (hash: string) => void) {
    const lastFinalized = await this.db.findMany('Proposal', {
      where: { finalized: true },
      orderBy: { proposedAt: 'desc' },
      limit: 1,
    })
    const fromBlock = lastFinalized[0]?.proposedAt || 0
    this.finalizationSubscriber = this.l1Contract.coordinator.events
      .Finalized({ fromBlock })
      .on('connected', subId => {
        logger.info(
          `synchronizer.js: Finalization listener is connected. Id: ${subId}`,
        )
      })
      .on('data', async event => {
        let blockHash: string
        if (typeof event.returnValues === 'string')
          blockHash = event.returnValues
        else blockHash = (event.returnValues as any).blockHash
        const hash = Bytes32.from(blockHash).toString()
        logger.debug(`finalization hash@!${hash}`)
        logger.debug(`${JSON.stringify(event.returnValues)}`)
        await this.blockCache.upsertCache(
          'Proposal',
          {
            where: { hash },
            create: { hash, finalized: true },
            update: { finalized: true },
          },
          event.blockNumber,
          event.blockHash,
        )
        if (cb) cb(blockHash)
      })
      .on('changed', event => {
        this.blockCache.clearChangesForBlockHash(event.blockHash)
        logger.info(`synchronizer.js: Finalization Event changed`, event)
      })
      .on('error', err => {
        // TODO removed
        logger.info(`synchronizer.js: Finalization Event error occured`, err)
      })
  }

  async fetchUnfetchedProposals() {
    const MAX_FETCH_JOB = 10
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
    logger.info('fetched block proposal')
    if (this.fetching[proposalTx]) return
    const proposalData = await this.l1Contract.web3.eth.getTransaction(
      proposalTx,
    )
    if (!proposalData.blockHash) {
      logger.trace(`pended proposal tx: ${proposalTx}`)
      return
    }
    this.fetching[proposalTx] = true
    const block = Block.fromTx(proposalData)
    const header = block.getHeaderSql()
    try {
      await this.db.upsert('Block', {
        where: { hash: header.hash },
        create: { hash: header.hash },
        update: {},
      })
      await this.db.upsert('Header', {
        where: { hash: header.hash },
        create: header,
        update: header,
      })
      await this.db.update('Proposal', {
        where: { hash: header.hash },
        update: {
          proposalData: JSON.stringify(proposalData),
        },
      })
    } catch (err) {
      logger.error(err)
      process.exit()
    }
    this.emit(NetworkStatus.ON_FETCHED, block)
    delete this.fetching[proposalTx]
  }
}
