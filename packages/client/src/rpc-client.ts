/* eslint-disable no-underscore-dangle */
import {
  BaseProvider,
  WebSocketProvider,
  JsonRpcProvider,
} from '@ethersproject/providers'
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

  private _provider?: BaseProvider

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

  // Return a provider instance from ethers
  get provider() {
    if (!this._provider) {
      if (this.config.l1Provider) {
        this._provider = this.config.l1Provider
      } else if (this.config.url.startsWith('http')) {
        this._provider = new JsonRpcProvider(this.config.url)
      } else if (this.config.url.startsWith('ws')) {
        this._provider = new WebSocketProvider(this.config.url)
      } else {
        this._provider = new BaseProvider(this.config.url)
      }
    }
    return this._provider
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

  async getVerifyingKeys(): Promise<any> {
    const { result } = await this.callMethod(RpcMethod.vks)
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
