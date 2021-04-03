/* eslint-disable no-underscore-dangle */
import Web3 from 'web3'
import { RpcType, RpcConfig, Block, Tx, Registry } from './types'
import fetch from './fetch'

enum RpcMethod {
  address = 'l1_address',
  vks = 'l1_getVKs',
  syncing = 'l2_syncing',
  blockCount = 'l2_blockCount',
  blockNumber = 'l2_blockNumber',
  blockByIndex = 'l2_getBlockByIndex',
  blockByNumber = 'l2_getBlockByNumber',
  blockByHash = 'l2_getBlockByHash',
  transactionByHash = 'l2_getTransactionByHash',
  registeredTokens = 'l2_getRegisteredTokens',
}

export default class RpcClient {
  config: RpcConfig

  private _web3?: Web3

  constructor(config: RpcConfig | string) {
    if (typeof config === 'string' && config.indexOf('http') === 0) {
      this.config = {
        type: RpcType.http,
        url: config,
      }
    } else if (typeof config === 'string' && config.indexOf('http') !== 0) {
      throw new Error(`Unsupported RPC protocol, only http(s) allowed`)
    } else if (typeof config === 'object' && config.url.indexOf('http') === 0) {
      this.config = Object.assign(config, { type: RpcType.http })
    } else if (typeof config === 'object' && config.url.indexOf('http') !== 0) {
      throw new Error(`Unsupported RPC protocol, only http(s) allowed`)
    } else {
      throw new Error('Invalid config supplied')
    }
  }

  // Return a passthrough web3 instance
  get web3() {
    if (!this._web3) {
      this._web3 = new Web3(this.config.url as any)
    }
    return this._web3
  }

  async getAddress(): Promise<string> {
    const { result } = await this.callMethod(RpcMethod.address)
    return result
  }

  async syncing(): Promise<boolean> {
    const { result } = await this.callMethod(RpcMethod.syncing)
    return result
  }

  async getBlockCount(): Promise<number> {
    const { result } = await this.callMethod(RpcMethod.blockCount)
    return +result
  }

  async getBlockNumber(): Promise<number> {
    const { result } = await this.callMethod(RpcMethod.blockNumber)
    return +result
  }

  async getBlockByIndex(num: number | 'latest'): Promise<Block> {
    const { result } = await this.callMethod(RpcMethod.blockByIndex, num)
    return result
  }

  async getBlockByNumber(
    num: number | 'latest',
    includeUncles = false,
  ): Promise<Block> {
    const { result } = await this.callMethod(
      RpcMethod.blockByNumber,
      num,
      includeUncles,
    )
    return result
  }

  async getBlockByHash(hash: string | 'latest'): Promise<Block> {
    const { result } = await this.callMethod(RpcMethod.blockByHash, hash)
    return result
  }

  async getTransactionByHash(hash: string): Promise<Tx> {
    const { result } = await this.callMethod(RpcMethod.transactionByHash, hash)
    return result
  }

  async getRegisteredTokens(): Promise<Registry> {
    const { result } = await this.callMethod(RpcMethod.registeredTokens)
    return result
  }

  private async callMethod(method: RpcMethod, ...params: any[]) {
    if (this.config.type === RpcType.http) {
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `${Math.floor(Math.random() * 10000)}`,
          params,
          method,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'RPC http error')
      }
      return data
    }
    throw new Error(`Unsupported rpc type`)
  }
}
