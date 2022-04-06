/* eslint-disable camelcase, import/no-extraneous-dependencies */
import { FullNode, CoordinatorManager } from '@zkopru/core'
import { logger, validatePublicUrls, externalIp } from '@zkopru/utils'
import AsyncLock from 'async-lock'
import { BigNumber, BigNumberish, Signer } from 'ethers'
import {
  IBurnAuction,
  IBurnAuction__factory,
  IConsensusProvider,
  IConsensusProvider__factory,
} from '@zkopru/contracts'
import { TypedListener } from '@zkopru/contracts/typechain/common'
import { formatEther } from 'ethers/lib/utils'

export interface AuctionMonitorConfig {
  port: number
  maxBid: BigNumberish
  publicUrls?: string // TODO: use this
}

interface Bid {
  owner: string
  amount: BigNumber
}

export class AuctionMonitor {
  node: FullNode

  currentProposer: string

  consensusAddress: string

  startBlock = 0

  roundLength = 0

  currentRound = -1

  isProposable = false

  isProposableLastUpdated = 0

  account: Signer

  port: number | string

  maxBid: BigNumber

  nodeUrl = ''

  maxBidRounds = 15

  // How close the round in question needs to be for us to bid
  roundBidThreshold = 3

  // keyed dictionary of known bids for rounds
  // if entry exists, assume it's up to date
  bidsPerRound: { [key: number]: Bid } = {}

  bidLock = new AsyncLock()

  coordinatorManager: CoordinatorManager

  handleNewBlock?: (blockNumber: number) => Promise<void>

  constructor(node: FullNode, account: Signer, config: AuctionMonitorConfig) {
    this.node = node
    this.currentProposer = '0x0000000000000000000000000000000000000000'
    this.consensusAddress = '0x0000000000000000000000000000000000000000'
    this.account = account
    this.port = config.port
    this.maxBid = BigNumber.from(config.maxBid)
    this.nodeUrl = config.publicUrls || ''
    this.coordinatorManager = new CoordinatorManager(
      this.node.layer1.address,
      this.node.layer1.provider,
    )
  }

  async updateUrl(newUrl: string) {
    try {
      await this.auction()
        .connect(this.account)
        .setUrl(newUrl)
      await this.coordinatorManager.updateUrl(await this.account.getAddress())
    } catch (err) {
      logger.error(
        `coordinator/auction-monitor.ts - Error updating url ${(err as any).toString()}`,
      )
    }
  }

  async start() {
    const { layer1 } = this.node
    this.consensusAddress = await layer1.zkopru.consensusProvider()
    const auction = this.auction()
    const [startBlock, roundLength, blockNumber] = await Promise.all([
      auction.startBlock(),
      auction.roundLength(),
      layer1.provider.getBlockNumber(),
      this.updateIsProposable(),
    ])
    this.startBlock = +startBlock
    this.roundLength = +roundLength
    this.currentRound = this.roundForBlock(blockNumber)

    this.startBlockSubscription()
    this.startNewHighBidSubscription()
    this.startStakeSubscription()
    this.coordinatorManager.start()
    const accountAddress = await this.account.getAddress()

    const balance = await layer1.provider.getBalance(accountAddress)
    if (balance.eq(0)) {
      logger.info(
        `coordinator/auction-monitor.ts - Empty wallet, skipping auction participation`,
      )
      return
    }
    const myUrl = await auction.coordinatorUrls(accountAddress)
    if (!myUrl || myUrl !== this.nodeUrl) {
      const newUrl = this.nodeUrl || `${await externalIp()}:${this.port}`
      // This will throw if invalid
      validatePublicUrls(newUrl)
      logger.info(
        `coordinator/auction-monitor.ts - Setting public urls: ${newUrl}`,
      )
      await this.updateUrl(newUrl)
    }
    await this.bidIfNeeded()
  }

  startBlockSubscription() {
    const { layer1 } = this.node
    if (!this.handleNewBlock) {
      this.handleNewBlock = async (blockNumber: number) => {
        const newRound = this.roundForBlock(blockNumber)
        const midBlock = this.roundStartBlock(newRound) + this.roundLength / 2

        if (
          blockNumber >= midBlock &&
          this.isProposableLastUpdated < midBlock
        ) {
          // check if proposable
          await this.updateIsProposable()
        }
        if (newRound === this.currentRound) {
          return
        }
        const [activeProposer] = await Promise.all([
          this.auction().coordinatorForRound(newRound),
          this.updateIsProposable(),
        ])
        // Entered a new round, update the proposer
        this.currentRound = newRound
        this.currentProposer = activeProposer
        // Call on each new round
        await this.bidIfNeeded()
      }
      layer1.provider.on('block', this.handleNewBlock)
    }
  }

  startNewHighBidSubscription() {
    const auction = this.auction()
    const filter = auction.filters.NewHighBid()
    const listners = auction.listeners(filter)
    if (!listners.find(l => l === this.newHighBidReceived)) {
      auction.on(filter, this.newHighBidReceived)
    }
  }

  /**
   * TODO: Listen for slash events for this.context.account, StakeChanged
   * will not be called in this case
   * */
  async startStakeSubscription() {
    const filter = this.node.layer1.coordinator.filters.StakeChanged(
      await this.account.getAddress(),
    )
    const listners = this.node.layer1.coordinator.listeners(filter)
    if (!listners.find(l => l === this.updateIsProposable)) {
      this.node.layer1.coordinator.on(filter, this.updateIsProposable)
    }
  }

  async stop() {
    if (this.handleNewBlock) {
      this.node.layer1.provider.off('block', this.handleNewBlock)
    }
    const auction = this.auction()
    auction.off(auction.filters.NewHighBid(), this.newHighBidReceived)
    const { coordinator } = this.node.layer1
    coordinator.off(
      coordinator.filters.StakeChanged(await this.account.getAddress()),
      this.updateIsProposable,
    )
    await this.coordinatorManager.stop()
  }

  async functionalCoordinatorUrl(address: string): Promise<string | void> {
    return this.coordinatorManager.coordinatorUrl(address)
  }

  roundForBlock(blockNumber: number): number {
    if (this.roundLength === 0) return 0
    return Math.floor((blockNumber - this.startBlock) / this.roundLength)
  }

  roundStartBlock(roundNumber: number): number {
    return this.startBlock + this.roundLength * roundNumber
  }

  roundEndBlock(roundNumber: number): number {
    return this.roundStartBlock(roundNumber) + this.roundLength - 1
  }

  auction(): IBurnAuction {
    return IBurnAuction__factory.connect(
      this.consensusAddress,
      this.node.layer1.provider,
    )
  }

  consensus(): IConsensusProvider {
    return IConsensusProvider__factory.connect(
      this.consensusAddress,
      this.node.layer1.provider,
    )
  }

  async loadUrl(address: string) {
    await this.coordinatorManager.updateUrl(address)
  }

  async setMaxBid(newMaxBid: BigNumberish) {
    await this.bidLock.acquire('bidIfNeeded', async () => {
      this.maxBid = BigNumber.from(newMaxBid)
    })
    // Bid asynchronously
    this.bidIfNeeded()
  }

  private async bidIfNeeded() {
    if (this.bidLock.isBusy('bidIfNeeded')) return
    await this.bidLock.acquire('bidIfNeeded', async () => {
      const staked = await this.node.layer1.zkopru.isStaked(
        await this.account.getAddress(),
      )
      if (!staked) {
        logger.info(
          'coordinator/auction-monitor.ts - Skipping auction bid, not staked',
        )
        return
      }
      logger.info('coordinator/auction-monitor.ts - Examining auction state')
      // TODO: calculate these locally
      const auction = this.auction()
      const [earliestRound, latestRound] = await Promise.all([
        auction.earliestBiddableRound(),
        auction.latestBiddableRound(),
      ])
      const roundsToBid = [] as number[]
      for (let x = +earliestRound; x <= +latestRound; x += 1) {
        // Don't bid on too many at once
        if (roundsToBid.length > this.maxBidRounds) break
        let highBid = this.bidsPerRound[x]
        if (!highBid) {
          // possible race condition here with block header subscription?
          const {
            0: highBidAmount,
            1: highBidOwner,
          } = await auction.highestBidForRound(x)
          highBid = {
            amount: highBidAmount,
            owner: highBidOwner,
          }
          this.bidsPerRound[x] = highBid
        }
        if (
          highBid.amount.add(highBid.amount.div(10)).lt(this.maxBid) &&
          highBid.owner.toLowerCase() !==
            (await this.account.getAddress()).toLowerCase()
        ) {
          roundsToBid.push(x)
        }
      }
      // nothing to do
      if (roundsToBid.length === 0) return
      // sort in descending order
      roundsToBid.sort((a, b) => b - a)
      // next bid time, start bidding within 3 rounds
      const earliestBidRound = roundsToBid[roundsToBid.length - 1]
      const latestBidRound = roundsToBid[0]
      if (+earliestBidRound - this.currentRound > this.roundBidThreshold) {
        // Wait until as late as possible to start bidding
        // preferably call this function again
        logger.info('coordinator/auction-monitor.ts - Waiting to bid...')
        return
      }
      logger.info(
        `coordinator/auction-monitor.ts - Bidding on ${roundsToBid.length} auctions`,
      )
      // estimate the cost of bidding
      let weiCost = BigNumber.from(0)
      for (let x = 0; x < roundsToBid.length; x += 1) {
        const roundIndex = roundsToBid[x]
        // added above
        const currentBidAmount = this.bidsPerRound[roundIndex].amount
        const nextBidAmount = currentBidAmount.add(
          currentBidAmount.div(BigNumber.from(5)),
        )
        weiCost = weiCost.add(nextBidAmount)
      }
      logger.info(
        `coordinator/auction-monitor.ts - estimated cost: ${formatEther(
          weiCost,
        )} eth`,
      )
      logger.info(
        `coordinator/auction-monitor.ts - start round: ${earliestBidRound}`,
      )
      logger.info(
        `coordinator/auction-monitor.ts - end round: ${latestBidRound}`,
      )

      // get remain balance at pending and calculating eth amount for bidding
      const pendingBalance = await auction.pendingBalances(
        await this.account.getAddress(),
      )
      const needWeiCost = weiCost.sub(BigNumber.from(pendingBalance))

      try {
        const tx = await auction.multiBid(
          weiCost.div(BigNumber.from(roundsToBid.length)).toString(), // possible not exactly 20 percent higher previous bid amount
          this.maxBid.toString(),
          earliestBidRound,
          latestBidRound,
          {
            value: needWeiCost.lt(BigNumber.from(0))
              ? '0x0'
              : needWeiCost.toString(),
          },
        )
        await tx.wait()

        logger.info(
          `coordinator/auction-monitor.ts - Successfully bid on transactions`,
        )
      } catch (err) {
        logger.error(
          `coordinator/auction-monitor.ts - Error bidding on auctions ${(err as any).toString()}`,
        )
      }
    })
  }

  private async updateIsProposable() {
    const [isProposable, blockNumber] = await Promise.all([
      this.node.layer1.coordinator.isProposable(
        await this.account.getAddress(),
      ),
      this.node.layer1.provider.getBlockNumber(),
    ])
    logger.trace(
      `coordinator/auction-monitor.ts - Updated isProposable at block ${blockNumber}`,
    )
    this.isProposable = isProposable
    this.isProposableLastUpdated = blockNumber
  }

  private newHighBidReceived: TypedListener<
    [BigNumber, string, BigNumber],
    { roundIndex: BigNumber; bidder: string; amount: BigNumber }
  > = async (...event) => {
    const { roundIndex, bidder, amount } = event[3].args
    const currentRound = roundIndex.toNumber()
    this.bidsPerRound[currentRound] = {
      owner: bidder,
      amount,
    }
    if (
      bidder.toLowerCase() !==
        (await this.account.getAddress()).toLowerCase() &&
      !amount.gt(this.maxBid) &&
      currentRound - this.currentRound <= this.roundBidThreshold
    ) {
      // update our bid if we're close enough to trigger a bid
      await this.bidIfNeeded()
    }
    logger.info(
      `coordinator/auction-monitor.ts - New high bid for round ${currentRound}`,
    )
  }
}
