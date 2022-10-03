/* eslint-disable no-continue, no-underscore-dangle */
import { Provider } from '@ethersproject/providers'
import { logger } from '@zkopru/utils'
import {
  BurnAuction,
  BurnAuction__factory,
  ZkopruContract,
} from '@zkopru/contracts'
import { TypedEvent } from '@zkopru/contracts/typechain/common'
import fetch from 'node-fetch'

/**
 * Manages remote URLs for coordinators
 * Acts as a singleton for use anywhere
 * */

export class CoordinatorManager {
  private _address: string

  private _burnAuctionAddress?: string

  private _provider: Provider

  private _burnAuction?: BurnAuction

  urlsByAddress: { [addr: string]: string } = {}

  functionalUrlByAddress: { [addr: string]: string | undefined } = {}

  constructor(address: string, provider: Provider) {
    // address is the Zkopru contract address, NOT the burn auction address
    this._address = address
    this._provider = provider
  }

  // find some number of reachable coordinator urls
  async loadUrls(count = 1) {
    const urlPromises = [] as Promise<string | void>[]
    const urls = [] as string[]
    const burnAuction = await this.burnAuction()
    const startBlock = await burnAuction.startBlock()
    const blockCount = 500
    const latestBlock = await this._provider.getBlockNumber()
    let currentBlock = startBlock
    const loaded: { [key: string]: boolean } = {}
    for (;;) {
      const toBlock = +currentBlock + +blockCount
      const filter = burnAuction.filters.UrlUpdate()
      const updates = await burnAuction.queryFilter(
        filter,
        currentBlock,
        toBlock > latestBlock ? 'latest' : toBlock,
      )
      currentBlock = toBlock > latestBlock ? latestBlock : toBlock
      for (const { args } of updates) {
        if (loaded[args.coordinator]) continue
        loaded[args.coordinator] = true
        urlPromises.push(this.coordinatorUrl(args.coordinator))
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
    const newUrl = await burnAuction.coordinatorUrls(addr)
    if (newUrl !== this.urlsByAddress[addr]) {
      delete this.functionalUrlByAddress[addr]
    }
    this.urlsByAddress[addr] = newUrl
  }

  async activeCoordinator() {
    const burnAuction = await this.burnAuction()
    return burnAuction.activeCoordinator()
  }

  async activeCoordinatorUrl(): Promise<string | void> {
    const activeCoord = await this.activeCoordinator()
    const { DEFAULT_COORDINATOR } = process.env
    if (activeCoord === '0x0000000000000000000000000000000000000000') {
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
      logger.info(u)
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
    const burnAuction = await this.burnAuction()
    const filter = burnAuction.filters.UrlUpdate()
    burnAuction.on(filter, this.handleUrlUpdate)
  }

  async handleUrlUpdate(
    _: string,
    event: TypedEvent<[string] & { coordinator: string }>,
  ) {
    const { coordinator } = event.args
    try {
      await this.updateUrl(coordinator)
    } catch (err) {
      console.log(err)
    }
  }

  async stop() {
    const burnAuction = await this.burnAuction()
    const filter = burnAuction.filters.UrlUpdate()
    burnAuction.removeListener(filter, this.handleUrlUpdate)
  }

  async burnAuctionAddress() {
    if (this._burnAuctionAddress) {
      return this._burnAuctionAddress
    }
    const zkopru = new ZkopruContract(this._provider, this._address)
    this._burnAuctionAddress = await zkopru.zkopru.consensusProvider()
    return this._burnAuctionAddress
  }

  async burnAuction() {
    if (this._burnAuction) return this._burnAuction
    const address = await this.burnAuctionAddress()
    this._burnAuction = BurnAuction__factory.connect(address, this._provider)
    return this._burnAuction
  }
}
