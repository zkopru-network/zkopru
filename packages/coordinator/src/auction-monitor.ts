import { Layer1 } from '@zkopru/contracts'
import { Subscription } from 'web3-core-subscriptions'
import { FullNode } from '@zkopru/core'
import BN from 'bn.js'
import { Account } from 'web3-core'
import { logger } from '@zkopru/utils'
import AsyncLock from 'async-lock'
import axios from 'axios'
import dns from 'dns'

interface Bid {
  owner: string
  amount: BN
}

export class AuctionMonitor {
  node: FullNode

  blockSubscription?: Subscription<unknown>

  eventSubscription?: Subscription<unknown>

  currentProposer: string

  consensusAddress: string

  startBlock = 0

  roundLength = 0

  currentRound = -1

  isProposable = false

  isProposableLastUpdated = 0

  urlsByAddress: { [key: string]: string } = {}

  functionalUrlsByAddress: { [key: string]: string } = {}

  account: Account

  port: number | string

  // Values higher than this crash ganache :(
  maxBidRounds = 15

  maxBid = new BN(20000 * 10 ** 9)

  // How close the round in question needs to be for us to bid
  roundBidThreshold = 3

  // keyed dictionary of known bids for rounds
  // if entry exists, assume it's up to date
  bidsPerRound: { [key: number]: Bid } = {}

  bidLock = new AsyncLock()

  constructor(node: FullNode, account: Account, port: number | string) {
    this.node = node
    this.currentProposer = '0x0000000000000000000000000000000000000000'
    this.consensusAddress = '0x0000000000000000000000000000000000000000'
    this.account = account
    this.port = port
  }

  auction() {
    const { layer1 } = this.node
    return Layer1.getIBurnAuction(layer1.web3, this.consensusAddress)
  }

  consensus() {
    const { layer1 } = this.node
    return Layer1.getIConsensusProvider(layer1.web3, this.consensusAddress)
  }

  async updateUrl(newUrl: string) {
    const auction = this.auction()
    const { layer1 } = this.node
    try {
      await layer1.sendExternalTx(
        auction.methods.setUrl(newUrl),
        this.account,
        this.consensusAddress,
      )
      this.urlsByAddress[this.account.address] = newUrl
    } catch (err) {
      logger.error(err.toString())
      logger.error('Error updating url')
    }
  }

  async start() {
    const { layer1 } = this.node
    this.consensusAddress = await layer1.upstream.methods
      .consensusProvider()
      .call()
    const auction = this.auction()
    const [
      startBlock,
      roundLength,
      blockNumber,
      {
        data: { ip },
      },
    ] = await Promise.all([
      auction.methods.startBlock().call(),
      auction.methods.roundLength().call(),
      layer1.web3.eth.getBlockNumber(),
      axios.get('https://external-ip.now.sh'),
      this.updateIsProposable(),
    ])
    this.startBlock = +startBlock
    this.roundLength = +roundLength
    this.currentRound = this.roundForBlock(blockNumber)

    const url = `${ip}:${this.port}`
    const myUrl = await auction.methods
      .coordinatorUrls(this.account.address)
      .call()
    if (!myUrl) {
      // for sure set it
      await this.updateUrl(url)
    } else if (myUrl.split(',').indexOf(url) === -1) {
      // TODO: resolve domains to see if current ip is in list
      const urls = myUrl.split(',')
      let urlSet = false
      for (const u of urls) {
        const [host, port] = u.split(':')
        const addresses = await new Promise<dns.LookupAddress[]>((rs, rj) =>
          dns.lookup(
            host,
            {
              all: true,
            },
            (err, a) => (err ? rj(err) : rs(a)),
          ),
        )
        for (const { address } of addresses) {
          if (address === ip && (port || 80) === this.port) {
            // found the current ip/port via hostname lookup
            urlSet = true
          }
        }
        if (!urlSet) {
          // add the current external ip to the list
          // probably prompt the user
        }
      }
      // look for current external ip in list
      // if (urls.indexOf(url) === -1) {
      //   await layer1.sendExternalTx(
      //     auction.methods.setUrl(url),
      //     this.account,
      //     this.consensusAddress,
      //   )
      //   this.urlsByAddress[this.account.address] = url
      // }
    }

    this.startBlockSubscription()
    this.startEventSubscription()
    await this.bidIfNeeded()
  }

  startBlockSubscription() {
    if (this.blockSubscription) return
    const { layer1 } = this.node
    this.blockSubscription = layer1.web3.eth.subscribe(
      'newBlockHeaders',
      this.blockReceived.bind(this),
    )
  }

  startEventSubscription() {
    if (this.eventSubscription) return
    this.eventSubscription = (this.auction().events.allEvents(
      {},
      this.handleEvent.bind(this),
    ) as any) as Subscription<unknown>
  }

  stop() {
    if (this.blockSubscription) {
      this.blockSubscription.unsubscribe()
      this.blockSubscription = undefined
    }
    if (this.eventSubscription) {
      this.eventSubscription.unsubscribe()
      this.eventSubscription = undefined
    }
  }

  async functionalCoordinatorUrl(address: string): Promise<string | void> {
    if (this.functionalUrlsByAddress[address]) {
      return this.functionalUrlsByAddress[address]
    }
    await this.loadUrl(address)
    const url = this.urlsByAddress[address]
    if (!url) return
    const urls = url.split(',')
    if (urls.length === 0) return
    for (const u of urls) {
      // ping to see if it's active
      try {
        const fullUrl = `https://${u}`
        await axios.get(`${fullUrl}/price`, { timeout: 5000 })
        this.functionalUrlsByAddress[address] = fullUrl
        return fullUrl
      } catch (e) {
        // skip and test http
      }
      try {
        const fullUrl = `http://${u}`
        await axios.get(`${fullUrl}/price`, { timeout: 5000 })
        this.functionalUrlsByAddress[address] = fullUrl
        return fullUrl
      } catch (e) {
        // test next host/port combo
      }
    }
  }

  activeCoordinatorUrl() {
    return this.urlsByAddress[this.currentProposer]
  }

  roundForBlock(blockNumber: number) {
    return Math.floor((blockNumber - this.startBlock) / this.roundLength)
  }

  roundStartBlock(roundNumber: number) {
    return this.startBlock + this.roundLength * roundNumber
  }

  roundEndBlock(roundNumber: number) {
    return this.roundStartBlock(roundNumber) + this.roundLength - 1
  }

  async updateIsProposable() {
    const [isProposable, blockNumber] = await Promise.all([
      this.consensus()
        .methods.isProposable(this.account.address)
        .call(),
      this.node.layer1.web3.eth.getBlockNumber(),
    ])
    logger.info(`Updated isProposable at block ${blockNumber}: ${isProposable}`)
    this.isProposable = isProposable
    this.isProposableLastUpdated = blockNumber
  }

  async blockReceived(err, block) {
    if (err) {
      logger.error(err)
      return
    }
    const newRound = this.roundForBlock(block.number)
    const midBlock = this.roundStartBlock(newRound) + this.roundLength / 2
    if (block.number >= midBlock && this.isProposableLastUpdated < midBlock) {
      // check if proposable
      await this.updateIsProposable()
    }
    if (newRound === this.currentRound) {
      return
    }
    const [activeProposer] = await Promise.all([
      this.auction()
        .methods.coordinatorForRound(newRound)
        .call(),
      this.updateIsProposable(),
    ])
    // Entered a new round, update the proposer
    this.currentRound = newRound
    this.currentProposer = activeProposer
    if (!this.urlsByAddress[this.currentProposer]) {
      await this.loadUrl(this.currentProposer)
    }
    // Call on each new round
    await this.bidIfNeeded()
  }

  async loadUrl(address: string) {
    this.urlsByAddress[address] = await this.auction()
      .methods.coordinatorUrls(address)
      .call()
  }

  async handleEvent(err, data) {
    const { event } = data
    if (err) {
      console.log(err)
      return
    }
    if (event === 'NewHighBid') {
      const { roundIndex, bidder, amount } = data.returnValues
      this.bidsPerRound[roundIndex] = {
        owner: bidder,
        amount: new BN(amount),
      }
      if (
        bidder.toLowerCase() !== this.account.address.toLowerCase() &&
        !new BN(amount).gt(this.maxBid) &&
        roundIndex - this.currentRound <= this.roundBidThreshold
      ) {
        // update our bid if we're close enough to trigger a bid
        await this.bidIfNeeded()
      }
      logger.info(`New high bid for round ${roundIndex}`)
    } else if (event === 'UrlUpdate') {
      const { coordinator } = data.returnValues
      const newUrl = await this.auction()
        .methods.coordinatorUrls(coordinator)
        .call()
      this.urlsByAddress[coordinator] = newUrl
    }
  }

  async setMaxBid(newMaxBid: BN | string) {
    await this.bidLock.acquire('bidIfNeeded', async () => {
      this.maxBid = new BN(newMaxBid)
    })
    // Bid asynchronously
    this.bidIfNeeded()
  }

  async bidIfNeeded() {
    if (this.bidLock.isBusy('bidIfNeeded')) return
    await this.bidLock.acquire('bidIfNeeded', async () => {
      logger.info('Examining auction state')
      const auction = this.auction()
      // TODO: calculate these locally
      const [earliestRound, latestRound] = await Promise.all([
        auction.methods.earliestBiddableRound().call(),
        auction.methods.latestBiddableRound().call(),
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
          } = await auction.methods.highestBidForRound(x).call()
          highBid = {
            amount: new BN(highBidAmount),
            owner: highBidOwner,
          }
          this.bidsPerRound[x] = highBid
        }
        if (
          highBid.amount
            .add(highBid.amount.div(new BN('10')))
            .lt(this.maxBid) &&
          highBid.owner.toLowerCase() !== this.account.address.toLowerCase()
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
        logger.info('Waiting to bid...')
        return
      }
      logger.info(`Bidding on ${roundsToBid.length} auctions`)
      // estimate the cost of bidding
      let weiCost = new BN('0')
      for (let x = 0; x < roundsToBid.length; x += 1) {
        const roundIndex = roundsToBid[x]
        // added above
        const currentBidAmount = this.bidsPerRound[roundIndex].amount
        const nextBidAmount = currentBidAmount.add(
          currentBidAmount.div(new BN('10')),
        )
        weiCost = weiCost.clone().add(nextBidAmount)
      }
      logger.info(
        `estimated cost: ${this.node.layer1.web3.utils.fromWei(weiCost)} eth`,
      )
      logger.info(`start round: ${earliestBidRound}`)
      logger.info(`end round: ${latestBidRound}`)
      try {
        const tx = auction.methods.multiBid(
          0,
          this.maxBid.toString(),
          earliestBidRound,
          latestBidRound,
        )
        await this.node.layer1.sendExternalTx(
          tx,
          this.account,
          this.consensusAddress,
          {
            value: weiCost.toString(),
          },
        )
        logger.info(`Successfully bid on transactions`)
      } catch (err) {
        logger.error(err)
        logger.error(`Error bidding on auctions`)
      }
    })
  }
}
