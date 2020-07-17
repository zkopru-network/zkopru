/* eslint-disable @typescript-eslint/camelcase */
import { ZkAccount } from '@zkopru/account'
import { DB } from '@zkopru/prisma'
import { Grove, poseidonHasher, keccakHasher } from '@zkopru/tree'
import { logger } from '@zkopru/utils'
import { Uint256 } from 'soltypes'
import { scheduleJob, Job } from 'node-schedule'
import { EventEmitter } from 'events'
import assert from 'assert'
import { L1Contract } from './layer1'
import { Verifier, VerifyOption } from './verifier'
import { L2Chain } from './layer2'
import { BootstrapHelper } from './bootstrap'
import { Synchronizer } from './synchronizer'
import { Block } from './block'

export enum NetworkStatus {
  STOPPED = 'stopped',
  ON_SYNCING = 'on syncing',
  ON_PROCESSING = 'processing',
  SYNCED = 'synced',
  FULLY_SYNCED = 'fully synced',
  ON_ERROR = 'on error',
}

export enum BlockEvents {
  ON_FETCHED = 'onFetched',
}

export class ZkOPRUNode extends EventEmitter {
  db: DB

  l1Contract: L1Contract

  l2Chain: L2Chain

  verifier: Verifier

  synchronizer: Synchronizer

  bootstrapHelper?: BootstrapHelper

  accounts?: ZkAccount[]

  verifyOption: VerifyOption

  cronJobs: Job[]

  fetching: {
    [proposalTx: string]: boolean
  }

  processingBlocks = false

  status: NetworkStatus

  latestProcessed?: number

  syncing: boolean

  constructor({
    db,
    l1Contract,
    l2Chain,
    verifier,
    synchronizer,
    bootstrapHelper,
    accounts,
    verifyOption,
  }: {
    db: DB
    l1Contract: L1Contract
    l2Chain: L2Chain
    verifier: Verifier
    bootstrapHelper?: BootstrapHelper
    synchronizer: Synchronizer
    accounts?: ZkAccount[]
    verifyOption: VerifyOption
  }) {
    super()
    this.db = db
    this.l1Contract = l1Contract
    this.l2Chain = l2Chain
    this.verifier = verifier
    this.synchronizer = synchronizer
    this.bootstrapHelper = bootstrapHelper
    this.accounts = accounts
    this.verifyOption = verifyOption
    this.status = NetworkStatus.STOPPED
    this.cronJobs = []
    this.fetching = {}
    this.syncing = false
  }

  startSync() {
    if (!this.syncing) {
      logger.info('start sync')
      this.setStatus(NetworkStatus.ON_SYNCING)
      this.synchronizer.sync()
      this.cronJobs = [
        scheduleJob('*/1 * * * * *', () => {
          this.updateStatus()
          this.fetchUnfetchedProposals()
          this.processBlocks()
        }),
      ]
      this.syncing = true
    } else {
      logger.info('already on syncing')
    }
  }

  stopSync() {
    if (this.syncing) {
      logger.info('stop sync')
      while (this.cronJobs.length > 0) {
        ;(this.cronJobs.pop() as Job).cancel()
      }
      this.setStatus(NetworkStatus.STOPPED)
      this.synchronizer.stop()
      this.syncing = false
    } else {
      logger.info('already stopped')
    }
  }

  async processBlocks() {
    if (this.processingBlocks) return
    this.processingBlocks = true
    let processedAll: boolean
    do {
      try {
        processedAll = await this.processBlock()
      } catch (err) {
        // TODO needs to provide roll back & resync option
        // sync & process error
        logger.error(err)
        break
      }
    } while (!processedAll)
    this.processingBlocks = false
  }

  async latestBlock(): Promise<string | null> {
    if (this.status === NetworkStatus.FULLY_SYNCED) {
      const latestHash = await this.l2Chain.getLatestVerified()
      return latestHash
    }
    return null
  }

  async updateStatus() {
    const unfetched = await this.db.read(prisma =>
      prisma.proposal.count({
        where: { fetched: null },
      }),
    )
    const unverified = await this.db.read(prisma =>
      prisma.proposal.count({
        where: { verified: { not: true } },
      }),
    )
    const haveFetchedAll = unfetched === 0
    const haveVerifiedAll = unverified === 0
    if (!haveFetchedAll) {
      this.setStatus(NetworkStatus.ON_SYNCING)
    } else if (!haveVerifiedAll) {
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

  async fetchUnfetchedProposals() {
    const MAX_FETCH_JOB = 10
    const availableFetchJob = Math.max(
      MAX_FETCH_JOB - Object.keys(this.fetching).length,
      0,
    )
    if (availableFetchJob === 0) return
    const candidates = await this.db.read(prisma =>
      prisma.proposal.findMany({
        where: {
          AND: [{ fetched: null }, { proposalTx: { not: null } }],
        },
        orderBy: {
          proposalNum: 'asc',
        },
        take: availableFetchJob,
      }),
    )

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
    const block = Block.fromTx(proposalData)
    const header = block.getHeaderSql()
    try {
      await this.db.write(prisma =>
        prisma.proposal.update({
          where: { hash: header.hash },
          data: {
            block: {
              upsert: {
                create: {
                  header: {
                    create: header,
                  },
                },
                update: {
                  header: {
                    connect: {
                      hash: header.hash,
                    },
                  },
                },
              },
            },
            proposalData: JSON.stringify(proposalData),
          },
        }),
      )
    } catch (err) {
      logger.error(err)
      process.exit()
    }
    this.emit(BlockEvents.ON_FETCHED, block)
    delete this.fetching[proposalTx]
  }

  private setLatestProcessed(proposalNum: number) {
    if (this.latestProcessed !== proposalNum) {
      logger.info(`Latest processed: ${proposalNum}`)
      this.latestProcessed = proposalNum
    }
  }

  /**
   * Fork choice rule: we choose the oldest valid block when there exists a fork
   * @returns processedAll
   */
  private async processBlock(): Promise<boolean> {
    const unprocessed = await this.l2Chain.getOldestUnprocessedBlock()
    if (!unprocessed) {
      if (!this.latestProcessed) {
        const latestProcessed = await this.db.read(prisma =>
          prisma.proposal.findMany({
            where: { verified: { not: null } },
            orderBy: { proposalNum: 'desc' },
            take: 1,
            include: { block: true },
          }),
        )
        const latest = latestProcessed.pop()
        this.setLatestProcessed(latest?.proposalNum || 0)
      }
      return true
    }
    const { parent, block, proposal } = unprocessed
    logger.info(`Processing block ${block.hash.toString()}`)
    // should find and save my notes before calling getGrovePatch
    await this.l2Chain.findMyUtxos(block.body.txs, this.accounts || [])
    await this.l2Chain.findMyWithdrawals(block.body.txs, this.accounts || [])
    const treePatch = await this.l2Chain.getGrovePatch(block)
    const { patch, challenge } = await this.verifier.verifyBlock({
      layer2: this.l2Chain,
      prevHeader: parent,
      treePatch,
      block,
    })
    if (!proposal.proposalNum) throw Error('Invalid proposal data')
    this.setLatestProcessed(proposal.proposalNum)
    if (patch) {
      // check if there exists fork
      const canonical = await this.db.read(prisma =>
        prisma.proposal.findMany({
          where: {
            AND: [
              { proposedAt: { lt: proposal.proposedAt } },
              {
                block: {
                  header: {
                    parentBlock: {
                      equals: block.header.parentBlock.toString(),
                    },
                  },
                },
              },
              { verified: true },
            ],
          },
          orderBy: { proposalNum: 'asc' },
          take: 1,
        }),
      )
      const forkExist = canonical.length === 1
      if (forkExist) {
        logger.warn('Sibling exists. Leave this as an uncle block')
      } else {
        await this.l2Chain.applyPatch(patch)
      }
      // Mark as verified
      await this.db.write(prisma =>
        prisma.proposal.update({
          where: { hash: block.hash.toString() },
          data: {
            verified: true,
            isUncle: forkExist ? true : null,
          },
        }),
      )
    } else if (challenge) {
      // implement challenge here & mark as invalidated
      await this.db.write(prisma =>
        prisma.proposal.update({
          where: { hash: block.hash.toString() },
          data: { verified: false },
        }),
      )
      logger.warn(challenge)
    }
    // TODO remove proposal data if it completes verification or if the block is finalized
    return false
  }

  private setStatus(status: NetworkStatus) {
    if (this.status !== status) {
      this.status = status
      // this.emit('status', status, this.latestProposedHash)
      logger.info(`sync status: ${status}`)
      this.emit('status', status)
    }
  }

  static async getOrInitChain(
    db: DB,
    l1Contract: L1Contract,
    networkId: number,
    chainId: number,
    address: string,
    accounts?: ZkAccount[],
  ): Promise<L2Chain> {
    logger.info('Get or init chain')
    const pubKeysToObserve = accounts
      ? accounts.map(account => account.pubKey)
      : []
    const addressesToObserve = accounts
      ? accounts.map(account => account.address)
      : []

    const savedConfig = await db.read(prisma =>
      prisma.config.findOne({
        where: {
          networkId_chainId_address: {
            networkId,
            chainId,
            address,
          },
        },
      }),
    )
    const config = savedConfig || (await l1Contract.getConfig())
    const hashers = {
      utxo: poseidonHasher(config.utxoTreeDepth),
      withdrawal: keccakHasher(config.withdrawalTreeDepth),
      nullifier: keccakHasher(config.nullifierTreeDepth),
    }
    const grove = new Grove(db, {
      ...config,
      utxoHasher: hashers.utxo,
      withdrawalHasher: hashers.withdrawal,
      nullifierHasher: hashers.nullifier,
      fullSync: true,
      forceUpdate: false,
      pubKeysToObserve,
      addressesToObserve,
    })
    await grove.init()
    return new L2Chain(db, grove, config)
  }
}
