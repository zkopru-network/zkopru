import fetch from 'node-fetch'
import { RpcType, RpcConfig, Block, Tx, Registry } from './types'

export default class RpcClient {
  config: RpcConfig

  constructor(config: RpcConfig) {
    this.config = config
  }

  async getAddress(): Promise<string> {
    const { result } = await this.callMethod('l1_address')
    return result
  }

  async getBlockNumber(): Promise<number> {
    const { result } = await this.callMethod('l2_blockNumber')
    return +result
  }

  async getBlockByNumber(num: number | string): Promise<Block> {
    const { result } = await this.callMethod('l2_getBlockByNumber', num)
    return result
  }

  async getBlockByHash(hash: string): Promise<Block> {
    const { result } = await this.callMethod('l2_getBlockByHash', hash)
    return result
  }

  async getTransactionByHash(hash: string): Promise<Tx> {
    const { result } = await this.callMethod('l2_getTransactionByHash', hash)
    return result
  }

  async getRegisteredTokens(): Promise<Registry> {
    const { result } = await this.callMethod('l2_getRegisteredTokens')
    return result
  }

  private async callMethod(method: string, ...params: any[]) {
    if (this.config.type === RpcType.http) {
      const response = await fetch(this.config.url, {
        method: 'POST',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `${Math.floor(Math.random() * 10000)}`,
          params,
          method,
        }),
      })
      const data = await response.json()
      return data
    }
    throw new Error(`Unsupported rpc type`)
  }
}
