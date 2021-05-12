/* eslint-disable no-continue, no-underscore-dangle */
import Web3 from 'web3'
import { logger } from '@zkopru/utils'
import { Layer1 } from '@zkopru/contracts'
import fetch from 'node-fetch'

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

  functionalUrlByAddress: { [addr: string]: string } = {}

  constructor(address: string, web3: Web3) {
    // address is the Zkopru contract address, NOT the burn auction address
    this._address = address
    this._web3 = web3
  }

  async loadUrls() {
    const blockCount = 1000
    const latestBlock = await this._web3.eth.getBlockNumber()
    const burnAuction = await this.burnAuction()
    for (let x = 0; x < 50; x += 1) {
      const updates = await burnAuction.getPastEvents('UrlUpdate', {
        fromBlock: latestBlock - (x + 1) * blockCount,
        toBlock: latestBlock - x * blockCount,
      })
      const promises = [] as Promise<any>[]
      const loading: { [key: string]: boolean } = {}
      for (const { returnValues } of updates) {
        if (
          this.urlsByAddress[returnValues.coordinator] ||
          loading[returnValues.coordinator]
        )
          continue
        loading[returnValues.coordinator] = true
        promises.push(this.updateUrl(returnValues.coordinator))
      }
      await Promise.all(promises)
    }
  }

  async updateUrl(addr: string) {
    const burnAuction = await this.burnAuction()
    const newUrl = await burnAuction.methods.coordinatorUrls(addr).call()
    this.urlsByAddress[addr] = newUrl
  }

  async activeCoordinator() {
    const burnAuction = await this.burnAuction()
    return burnAuction.methods.activeCoordinator().call()
  }

  async activeCoordinatorUrl(): Promise<string | void> {
    // TODO: update when current round changes
    // calculate offline using UTC time
    const activeCoord = await this.activeCoordinator()
    if (!activeCoord) return
    return this.coordinatorUrl(activeCoord)
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
        delete this.functionalUrlByAddress[coordinator]
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
