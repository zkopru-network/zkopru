/* eslint-disable @typescript-eslint/camelcase */
import { ZkAccount } from '@zkopru/account'
import { DB, Proposal } from '@zkopru/prisma'
import { Grove, poseidonHasher, keccakHasher } from '@zkopru/tree'
import { logger } from '@zkopru/utils'
import { Uint256 } from 'soltypes'
import AsyncLock from 'async-lock'
import { scheduleJob, Job } from 'node-schedule'
import { EventEmitter } from 'events'
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

export class ZkOPRUNode extends EventEmitter {
  lock: AsyncLock

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

  runningSerialProcessing = false

  status: NetworkStatus

  latestProposed?: number

  latestProcessed?: number

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
    this.lock = new AsyncLock()
    this.cronJobs = []
    this.fetching = {}
  }

  private setStatus(status: NetworkStatus) {
    if (this.status !== status) {
      this.status = status
      // this.emit('status', status, this.latestProposedHash)
      logger.info(`sync status: ${status}`)
      this.emit('status', status)
    }
  }

  startSync() {
    logger.info('start sync')
    this.setStatus(NetworkStatus.ON_SYNCING)
    this.synchronizer.sync()
    this.cronJobs = [
      scheduleJob('*/1 * * * * *', () => {
        this.updateStatus()
        this.fetchUnfetchedProposals()
        this.processUnverifiedBlocks()
        this.checkBlockUpdate()
      }),
    ]
  }

  stopSync() {
    logger.info('stop sync')
    while (this.cronJobs.length > 0) {
      ;(this.cronJobs.pop() as Job).cancel()
    }
    this.setStatus(NetworkStatus.STOPPED)
    this.synchronizer.stop()
  }

  async processUnverifiedBlocks(recursive?: boolean) {
    if (this.runningSerialProcessing && !recursive) {
      // Skip cron job calling becaus it is processing blocks recursively
      return
    }
    const { prevHeader, block } = await this.l2Chain.getOldestUnverifiedBlock()
    if (!block) {
      // if once it processed all blocks, it will stop its recursive call
      this.runningSerialProcessing = false
      return
    }
    // Once it finds an unverified block, starts recursive processing
    this.runningSerialProcessing = true
    if (!prevHeader)
      throw Error('Unexpected runtime error occured during the verification.')
    const patch = await this.verifier.verifyBlock({
      layer1: this.l1Contract,
      layer2: this.l2Chain,
      prevHeader,
      block,
    })
    await this.l2Chain.applyPatchAndMarkAsVerified(patch)
    this.processUnverifiedBlocks(true)
  }

  async latestBlock(): Promise<string | null> {
    if (this.status === NetworkStatus.FULLY_SYNCED) {
      const latestHash = await this.l2Chain.getLatestVerified()
      return latestHash
    }
    return null
  }

  checkBlockUpdate() {
    this.lock.acquire('db', async () => {
      const proposals = await this.db.prisma.proposal.findMany({
        orderBy: {
          proposalNum: 'desc',
        },
        take: 1,
      })
      if (proposals[0]?.proposalNum) {
        this.setLatestProposed(proposals[0]?.proposalNum)
      }
      const verifiedProposals = await this.db.prisma.proposal.findMany({
        where: {
          block: {
            verified: true,
          },
        },
        orderBy: {
          proposalNum: 'desc',
        },
        take: 1,
      })
      if (verifiedProposals[0]) {
        this.setLatestProcessed(verifiedProposals[0].proposalNum + 1)
      }
    })
  }

  private setLatestProposed(proposalNum: number) {
    if (proposalNum && this.latestProposed !== proposalNum) {
      this.latestProposed = proposalNum
    }
  }

  private setLatestProcessed(proposalNum: number) {
    if (this.latestProcessed !== proposalNum) {
      this.latestProcessed = proposalNum
    }
  }

  async updateStatus() {
    let unfetched!: number
    let unverified!: number
    await this.lock.acquire('db', async () => {
      unfetched = await this.db.prisma.proposal.count({
        where: { fetched: null },
      })
      unverified = await this.db.prisma.block.count({
        where: { verified: { not: true } },
      })
    })
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
      if (layer1ProposedBlocks.toBN().eqn(this.latestProcessed || 0)) {
        this.setStatus(NetworkStatus.FULLY_SYNCED)
      } else if (
        layer1ProposedBlocks.toBN().ltn((this.latestProcessed || 0) + 2)
      ) {
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
    let candidates!: Proposal[]
    await this.lock.acquire('db', async () => {
      candidates = await this.db.prisma.proposal.findMany({
        where: { fetched: null },
        orderBy: {
          proposalNum: 'asc',
        },
        take: availableFetchJob,
      })
    })

    candidates.forEach(candidate => {
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
    await this.lock.acquire('db', async () => {
      await this.db.prisma.proposal.update({
        where: {
          hash: header.hash,
        },
        data: {
          block: {
            create: {
              header: {
                create: header,
              },
            },
          },
          proposalData: JSON.stringify(proposalData),
        },
      })
    })
    delete this.fetching[proposalTx]
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

    const savedConfig = await db.prisma.config.findOne({
      where: {
        networkId_chainId_address: {
          networkId,
          chainId,
          address,
        },
      },
    })
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
