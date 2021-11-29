/* eslint-disable @typescript-eslint/camelcase */
import assert from 'assert'
import { logger, Worker } from '@zkopru/utils'
import {
  DB,
  Header as HeaderSql,
  Deposit as DepositSql,
  Utxo as UtxoSql,
  MassDeposit as MassDepositSql,
  TokenRegistry as TokenRegistrySql,
  BlockCache,
} from '@zkopru/database'
import { EventEmitter } from 'events'
import { Bytes32, Address, Uint256 } from 'soltypes'
import { Note, ZkAddress } from '@zkopru/transaction'
import { Fp } from '@zkopru/babyjubjub'
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

  depositUtxoSubscriber?: EventEmitter

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
    if (!this.isListening) {
      this.listenGenesis()
      this.listenTokenRegistry()
      this.listenDeposits()
      this.listenSlash()
      this.listenMassDepositCommit()
      this.listenNewProposals(proposalCB)
      this.listenFinalization(finalizationCB)
      if (accounts) {
        this.listenDepositUtxos(accounts)
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
    const subscribers = [
      this.proposalSubscriber,
      this.slashSubscriber,
      this.erc20RegistrationSubscriber,
      this.erc721RegistrationSubscriber,
      this.depositSubscriber,
      this.depositUtxoSubscriber,
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
    logger.trace(`core/synchronizer - Synchronizer::updateStatus()`)
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
    logger.trace(
      `core/synchronizer - Synchronizer::setLatestProcessed(${proposalNum})`,
    )
    if ((this.latestProcessed || 0) < proposalNum) {
      this.latestProcessed = proposalNum
      this.l1Contract.upstream.methods
        .proposedBlocks()
        .call()
        .then(num => {
          const layer1ProposedBlocks = Uint256.from(num)
            .toBN()
            .subn(1) // proposal num starts from 0
            .toString(10)
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

  async listenGenesis() {
    logger.trace(`core/synchronizer - Synchronizer::listenGenesis()`)
    const numOfGenesisBlock = await this.db.count('Proposal', {
      proposalNum: 0,
    })
    if (numOfGenesisBlock === 0) {
      logger.info('core/synchronizer - No genesis block. Trying to fetch')
      const genesisListener = this.l1Contract.upstream.events
        .GenesisBlock({ fromBlock: 0 })
        .on('data', async event => {
          const { returnValues, blockNumber, transactionHash } = event
          const { timestamp } = await this.l1Contract.web3.eth.getBlock(
            blockNumber,
          )
          // WRITE DATABASE
          const { blockHash, proposer, parentBlock } = returnValues
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

          await this.db.create('Proposal', {
            hash: blockHash,
            proposalNum: 0,
            canonicalNum: 0,
            proposedAt: blockNumber,
            proposalTx: transactionHash,
            finalized: true,
            verified: true,
            proposalData: '',
            timestamp,
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
    logger.trace(`core/synchronizer - Synchronizer::listenTokenRegistry()`)
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
        logger.info(`core/synchronizer - ERC20 token registered: ${tokenAddr}`)
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
        logger.info(`core/synchronizer - ERC721 token registered: ${tokenAddr}`)
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
    logger.trace(`core/synchronizer - Synchronizer::listenDeposits()`)
    const lastDeposits = await this.db.findMany('Deposit', {
      where: {},
      orderBy: { blockNumber: 'desc' },
      limit: 1,
    })
    const fromBlock = lastDeposits[0]?.blockNumber || 0
    logger.info(
      `core/synchronizer - Scan deposit hashes from block number ${fromBlock}`,
    )
    this.depositSubscriber = this.l1Contract.user.events
      .Deposit({ fromBlock })
      .on('connected', subId => {
        logger.info(
          `core/synchronizer - Deposit listener is connected. Id: ${subId}`,
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
        logger.info(`core/synchronizer - NewDeposit(${deposit.note})`)
        await this.blockCache.transactionCache(
          db => {
            db.upsert('Deposit', {
              where: { note: deposit.note },
              update: deposit,
              create: deposit,
            })
            db.delete('PendingDeposit', {
              where: {
                note: deposit.note,
              },
            })
          },
          blockNumber,
          event.blockHash,
        )
        if (cb) cb(deposit)
      })
      .on('changed', event => {
        this.blockCache.clearChangesForBlockHash(event.blockHash)
        logger.info(`core/synchronizer - Deposit Event changed`, event)
      })
      .on('error', event => {
        // TODO
        logger.info(`core/synchronizer - Deposit Event Error occured`, event)
      })
  }

  async listenDepositUtxos(
    addresses: ZkAddress[],
    cb?: (utxo: UtxoSql) => void,
  ) {
    logger.trace(`core/synchronizer - Synchronizer::listenDepositUtxos()`)
    const lastDeposits = await this.db.findMany('Utxo', {
      where: {},
      orderBy: { depositedAt: 'desc' },
      limit: 1,
    })
    const fromBlock = lastDeposits[0]?.blockNumber || 0
    logger.info(
      `core/synchronizer - Scan deposit details from block number ${fromBlock}`,
    )
    this.depositUtxoSubscriber = this.l1Contract.user.events
      .DepositUtxo({
        fromBlock,
        filter: {
          spendingPubKey: addresses.map(address => address.spendingPubKey()),
        },
      })
      .on('connected', subId => {
        logger.info(
          `core/synchronizer - DepositUtxo listener is connected. Id: ${subId}`,
        )
      })
      .on('data', async event => {
        const { returnValues, blockNumber } = event
        const owner = addresses.find(addr =>
          Fp.from(returnValues.spendingPubKey).eq(addr.spendingPubKey()),
        )
        if (!owner) {
          // skip storing Deposit details
          return
        }
        const salt = Fp.from(returnValues.salt)
        const note = new Note(owner, salt, {
          eth: Fp.from(returnValues.eth),
          tokenAddr: Fp.from(Address.from(returnValues.token).toBN()),
          erc20Amount: Fp.from(returnValues.amount),
          nft: Fp.from(returnValues.nft),
        })
        const utxo: UtxoSql = {
          hash: note
            .hash()
            .toUint256()
            .toString(),
          eth: note
            .eth()
            .toUint256()
            .toString(),
          owner: owner.toString(),
          salt: note.salt.toUint256().toString(),
          tokenAddr: note
            .tokenAddr()
            .toHex()
            .toString(),
          erc20Amount: note
            .erc20Amount()
            .toUint256()
            .toString(),
          nft: note
            .nft()
            .toUint256()
            .toString(),
          depositedAt: blockNumber,
        }
        logger.info(`core/synchronizer - Discovered my deposit (${utxo.hash})`)
        await this.blockCache.transactionCache(
          db => {
            db.upsert('Utxo', {
              where: { hash: utxo.hash },
              update: utxo,
              create: utxo,
            })
            db.update('Deposit', {
              where: {
                note: note
                  .hash()
                  .toUint256()
                  .toString(),
              },
              update: {
                ownerAddress: owner.toString(),
              },
            })
          },
          blockNumber,
          event.blockHash,
        )
        try {
          // try to load the transaction sender
          const tx = await this.l1Contract.web3.eth.getTransaction(
            event.transactionHash,
          )
          await this.blockCache.updateCache(
            'Deposit',
            {
              where: {
                note: note
                  .hash()
                  .toUint256()
                  .toString(),
              },
              update: {
                from: tx.from,
              },
            },
            blockNumber,
            event.blockHash,
          )
        } catch (err) {
          logger.info(err)
          logger.erro('core/synchronizer - Error loading deposit transaction')
        }
        if (cb) cb(utxo)
      })
      .on('changed', event => {
        this.blockCache.clearChangesForBlockHash(event.blockHash)
        logger.info(`core/synchronizer - Deposit Event changed`, event)
      })
      .on('error', event => {
        // TODO
        logger.info(`core/synchronizer - Deposit Event Error occured`, event)
      })
  }

  async listenMassDepositCommit(cb?: (commit: MassDepositSql) => void) {
    logger.trace(`core/synchronizer - Synchronizer::listenMassDepositCommit()`)
    const lastMassDeposit = await this.db.findMany('MassDeposit', {
      where: {},
      orderBy: { blockNumber: 'desc' },
      limit: 1,
    })
    const fromBlock = lastMassDeposit[0]?.blockNumber || 0
    logger.info(
      `core/synchronizer - Scan mass deposits from block number ${fromBlock}`,
    )
    this.massDepositCommitSubscriber = this.l1Contract.coordinator.events
      .MassDepositCommit({ fromBlock })
      .on('connected', subId => {
        logger.info(
          `core/synchronizer - MassDepositCommit listener is connected. Id: ${subId}`,
        )
      })
      .on('data', async event => {
        const { returnValues, blockNumber } = event
        logger.info(
          `core/synchronizer - Total fee for MassDepositCommit #${returnValues.index}(${returnValues.merged}) is ${returnValues.fee} gwei`,
        )
        const massDeposit: MassDepositSql = {
          index: Uint256.from(returnValues.index).toString(),
          merged: Bytes32.from(returnValues.merged).toString(),
          fee: Uint256.from(returnValues.fee).toString(),
          blockNumber,
          includedIn: null,
        }
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
      })
      .on('changed', event => {
        this.blockCache.clearChangesForBlockHash(event.blockHash)
        logger.info(`core/synchronizer - MassDeposit Event changed`, event)
      })
      .on('error', event => {
        // TODO
        logger.info(
          `core/synchronizer - MassDeposit Event error changed`,
          event,
        )
      })
  }

  async listenNewProposals(cb?: (hash: string) => void) {
    logger.trace(`core/synchronizer - Synchronizer::listenNewProposals()`)
    const lastProposal = await this.db.findMany('Proposal', {
      where: {},
      orderBy: { proposedAt: 'desc' },
      limit: 1,
    })
    const fromBlock = lastProposal[0]?.proposedAt || 0
    logger.info(
      `core/synchronizer - Scan new proposals from block number ${fromBlock}`,
    )
    this.proposalSubscriber = this.l1Contract.coordinator.events
      .NewProposal({ fromBlock })
      .on('connected', subId => {
        logger.info(
          `core/synchronizer - NewProposal listener is connected. Id: ${subId}`,
        )
      })
      .on('data', async event => {
        const { returnValues, blockNumber, transactionHash } = event
        // WRITE DATABASE
        const { proposalNum, blockHash } = returnValues
        logger.info(
          `core/synchronizer - NewProposal: #${proposalNum}(${blockHash}) @ L1 #${blockNumber}`,
        )
        const { timestamp } = await this.l1Contract.web3.eth.getBlock(
          blockNumber,
        )
        const newProposal = {
          hash: Bytes32.from(blockHash).toString(),
          proposalNum: parseInt(proposalNum, 10),
          proposedAt: blockNumber,
          proposalTx: transactionHash,
          timestamp,
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
        logger.info(`core/synchronizer - NewProposal Event changed`, event)
      })
      .on('error', err => {
        // TODO
        logger.info(`core/synchronizer - NewProposal Event error occured`, err)
      })
  }

  async listenSlash(cb?: (hash: string) => void) {
    logger.trace(`core/synchronizer - Synchronizer::listenSlash()`)
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
          `core/synchronizer - Slash listener is connected. Id: ${subId}`,
        )
      })
      .on('data', async event => {
        const { returnValues, blockNumber, transactionHash } = event
        const hash = Bytes32.from(returnValues.blockHash).toString()
        const proposer = Address.from(returnValues.proposer).toString()
        const { reason } = returnValues

        logger.info(
          `core/synchronizer - Slash: ${proposer} proposed invalid block ${hash}(${reason}).`,
        )
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
        logger.info(`core/synchronizer - Slash Event changed`, event)
      })
      .on('error', err => {
        // TODO removed
        logger.info(`core/synchronizer - Slash Event error occured`, err)
      })
  }

  async listenFinalization(cb?: (hash: string) => void) {
    logger.trace(`core/synchronizer - Synchronizer::listenFinalization()`)
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
          `core/synchronizer - Finalization listener is connected. Id: ${subId}`,
        )
      })
      .on('data', async event => {
        let blockHash: string
        if (typeof event.returnValues === 'string')
          blockHash = event.returnValues
        else blockHash = (event.returnValues as any).blockHash
        const hash = Bytes32.from(blockHash).toString()
        logger.info(`core/synchronizer - Finalized ${hash}`)
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
        logger.info(`core/synchronizer - Finalized Event changed`, event)
      })
      .on('error', err => {
        // TODO removed
        logger.info(`core/synchronizer - Finalized Event error occured`, err)
      })
  }

  async fetchUnfetchedProposals() {
    logger.trace(`core/synchronizer - Synchronizer::fetchUnfetchedProposals()`)
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
    logger.trace(`core/synchronizer - Synchronizer::fetch()`)
    if (this.fetching[proposalTx]) return
    const proposalData = await this.l1Contract.web3.eth.getTransaction(
      proposalTx,
    )
    if (!proposalData.blockHash) {
      logger.debug(
        `core/synchronizer - waiting proposal transaction ${proposalTx} is confirmed`,
      )
      return
    }
    this.fetching[proposalTx] = true
    const block = Block.fromTx(proposalData)
    logger.info(
      `core/synchronizer - Fetched tx ${proposalTx} for block ${block.hash.toString()}`,
    )
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
