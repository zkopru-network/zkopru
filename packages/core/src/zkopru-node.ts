/* eslint-disable @typescript-eslint/camelcase */
import { ZkAccount } from '@zkopru/account'
import { DB } from '@zkopru/prisma'
import { Grove, poseidonHasher, keccakHasher } from '@zkopru/tree'
import { logger } from '@zkopru/utils'
import { Uint256 } from 'soltypes'
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

  onlyRunRecursiveCall = false

  status: NetworkStatus

  latestProposed?: number

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

  private setStatus(status: NetworkStatus) {
    if (this.status !== status) {
      this.status = status
      // this.emit('status', status, this.latestProposedHash)
      logger.info(`sync status: ${status}`)
      this.emit('status', status)
    }
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
          this.processUnverifiedBlocks()
          this.checkBlockUpdate()
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

  async processUnverifiedBlocks(recursive?: boolean) {
    if (this.onlyRunRecursiveCall && !recursive) {
      // Skip cron job calling becaus it is processing blocks recursively
      return
    }
    const { prevHeader, block } = await this.l2Chain.getOldestUnverifiedBlock()
    if (!block) {
      // if it processes all blocks, it will stop its recursive call
      this.onlyRunRecursiveCall = false
      return
    }
    // Once it finds an unverified block, starts recursive processing
    this.onlyRunRecursiveCall = true
    if (!prevHeader) {
      this.onlyRunRecursiveCall = false
      throw Error('Unexpected runtime error occured during the verification.')
    }

    logger.info(`Processing block ${block.hash.toString()}`)
    try {
      const { patch, challenge } = await this.verifier.verifyBlock({
        layer2: this.l2Chain,
        prevHeader,
        block,
      })
      if (patch) {
        await this.l2Chain.applyPatchAndMarkAsVerified(patch)
        await this.l2Chain.findMyNotes(
          block.body.txs,
          patch.treePatch?.utxos || [],
          this.accounts || [],
        )
        this.processUnverifiedBlocks(true)
      } else if (challenge) {
        // implement challenge here & mark as invalidated
        this.onlyRunRecursiveCall = false
        logger.warn(challenge)
      }
    } catch (err) {
      // TODO needs to provide roll back & resync option
      // sync & process error
      this.onlyRunRecursiveCall = false
      logger.error(err)
    }
  }

  async latestBlock(): Promise<string | null> {
    if (this.status === NetworkStatus.FULLY_SYNCED) {
      const latestHash = await this.l2Chain.getLatestVerified()
      return latestHash
    }
    return null
  }

  async checkBlockUpdate() {
    const proposals = await this.db.read(prisma =>
      prisma.proposal.findMany({
        orderBy: {
          proposalNum: 'desc',
        },
        take: 1,
      }),
    )
    if (proposals[0]?.proposalNum) {
      this.setLatestProposed(proposals[0]?.proposalNum)
    }
    const verifiedProposals = await this.db.read(prisma =>
      prisma.proposal.findMany({
        where: {
          block: {
            verified: true,
          },
        },
        orderBy: {
          proposalNum: 'desc',
        },
        take: 1,
      }),
    )
    if (verifiedProposals[0]) {
      this.setLatestProcessed(verifiedProposals[0].proposalNum + 1)
    }
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
    const unfetched = await this.db.read(prisma =>
      prisma.proposal.count({
        where: { fetched: null },
      }),
    )
    const unverified = await this.db.read(prisma =>
      prisma.block.count({
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
    const candidates = await this.db.read(prisma =>
      prisma.proposal.findMany({
        where: { fetched: null },
        orderBy: {
          proposalNum: 'asc',
        },
        take: availableFetchJob,
      }),
    )

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
    try {
      await this.db.write(prisma =>
        prisma.proposal.update({
          where: {
            hash: header.hash,
          },
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
