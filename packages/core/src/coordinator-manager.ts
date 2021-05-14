/* eslint-disable no-continue, no-underscore-dangle */
import util from 'util'
import Web3 from 'web3'
import { logger } from '@zkopru/utils'
import { Layer1 } from '@zkopru/contracts'
import fetch from 'node-fetch'

export function logAll(Object) {
  return util.inspect(Object, {
    showHidden: true,
    depth: null,
  })
}

/**
 * Manages remote URLs for coordinators
 * Acts as a singleton for use anywhere
 * */

export class CoordinatorManager {
  private _address: string

  private _burnAuctionAddress?: string

  private _web3: Web3

  private _burnAuction: any

  urlUpdateSubscription?: any

  urlsByAddress: { [addr: string]: string } = {}

  functionalUrlByAddress: { [addr: string]: string | undefined } = {}

  constructor(address: string, web3: Web3) {
    // address is the Zkopru contract address, NOT the burn auction address
    this._address = address
    this._web3 = web3
  }

  // find some number of reachable coordinator urls
  async loadUrls(count = 1) {
    const urlPromises = [] as Promise<string | void>[]
    const urls = [] as string[]
    const burnAuction = await this.burnAuction()
    const startBlock = await burnAuction.methods.startBlock().call()
    const blockCount = 500
    const latestBlock = await this._web3.eth.getBlockNumber()
    let currentBlock = startBlock
    const loaded: { [key: string]: boolean } = {}
    for (;;) {
      const toBlock = +currentBlock + +blockCount
      const updates = await burnAuction.getPastEvents('UrlUpdate', {
        fromBlock: currentBlock,
        toBlock: toBlock > latestBlock ? 'latest' : toBlock,
      })
      currentBlock = toBlock > latestBlock ? latestBlock : toBlock
      for (const { returnValues } of updates) {
        if (loaded[returnValues.coordinator]) continue
        loaded[returnValues.coordinator] = true
        urlPromises.push(this.coordinatorUrl(returnValues.coordinator))
      }
      if (urlPromises.length >= count || +toBlock >= +latestBlock) {
        urls.push(
          ...((await Promise.all(urlPromises)).filter(u => !!u) as string[]),
        )
      }
      if (urls.length >= count) return urls
      if (+toBlock >= +latestBlock) return urls
    }
  }

  async updateUrl(addr: string) {
    const burnAuction = await this.burnAuction()
    const newUrl = await burnAuction.methods.coordinatorUrls(addr).call()
    if (newUrl !== this.urlsByAddress[addr]) {
      delete this.functionalUrlByAddress[addr]
    }
    this.urlsByAddress[addr] = newUrl
  }

  async activeCoordinator() {
    const burnAuction = await this.burnAuction()
    return burnAuction.methods.activeCoordinator().call()
  }

  async activeCoordinatorUrl(): Promise<string | void> {
    logger.info(`[CM] Process env in CoordinatorManger ${logAll(process.env)}`)
    const activeCoord = await this.activeCoordinator()
    const { DEFAULT_COORDINATOR } = process.env
    if (activeCoord === '0x0000000000000000000000000000000000000000') {
      logger.info(`[CM] Could not read coordinator url`)
      const urls = await this.loadUrls()
      return urls[0] || DEFAULT_COORDINATOR
    }
    if (activeCoord) {
      return (await this.coordinatorUrl(activeCoord)) || DEFAULT_COORDINATOR
    }
    if (!activeCoord && !DEFAULT_COORDINATOR)
      throw new Error('Unable to determine coordinator url')
    return DEFAULT_COORDINATOR
  }

  async coordinatorUrl(addr: string): Promise<string | void> {
    if (this.functionalUrlByAddress[addr]) {
      return this.functionalUrlByAddress[addr]
    }
    await this.updateUrl(addr)
    const url = this.urlsByAddress[addr]
    if (!url) return
    const urls = url.split(',')
    if (urls.length === 0) return
    for (const u of urls) {
      logger.info(`[CM] coordinator url : ${u}`)
      // ping to see if it's active
      try {
        const fullUrl = `https://${u}`
        const r = await fetch(`${fullUrl}/price`)
        if (!r.ok) throw new Error()
        this.functionalUrlByAddress[addr] = fullUrl
        return fullUrl
      } catch (e) {
        // skip and test http
      }
      try {
        const fullUrl = `http://${u}`
        const r = await fetch(`${fullUrl}/price`)
        if (!r.ok) throw new Error()
        this.functionalUrlByAddress[addr] = fullUrl
        return fullUrl
      } catch (e) {
        // test next host/port combo
      }
    }
  }

  async start() {
    if (this.urlUpdateSubscription) return
    const burnAuction = await this.burnAuction()
    this.urlUpdateSubscription = burnAuction.events
      .UrlUpdate()
      .on('connected', (subId: string) => {
        logger.info(
          `coordinator manager: UrlUpdate listener connected. ID: ${subId}`,
        )
      })
      .on('data', async (data: any) => {
        const { coordinator } = data.returnValues
        logger.info(`Start then update Coordinator as ${coordinator}`)
        await this.updateUrl(coordinator)
      })
  }

  async stop() {
    if (!this.urlUpdateSubscription) return
    this.urlUpdateSubscription.removeAllListeners()
    this.urlUpdateSubscription = undefined
  }

  async burnAuctionAddress() {
    if (this._burnAuctionAddress) {
      return this._burnAuctionAddress
    }
    const zkopru = Layer1.getZkopru(this._web3, this._address)
    this._burnAuctionAddress = await zkopru.methods.consensusProvider().call()
    return this._burnAuctionAddress
  }

  async burnAuction() {
    if (this._burnAuction) return this._burnAuction
    const address = await this.burnAuctionAddress()
    this._burnAuction = Layer1.getIBurnAuction(this._web3, address)
    return this._burnAuction
  }
}
