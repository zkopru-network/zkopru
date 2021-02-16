import Web3 from 'web3'
import RpcClient from './rpc-client'
import { RpcConfig, RpcType } from './types'

/* eslint-disable no-underscore-dangle */

export default class ZkopruClient {
  config: RpcConfig

  private _web3?: Web3

  private _rpc?: RpcClient

  constructor(rpcUrl: string) {
    if (rpcUrl.indexOf('http') === 0) {
      // http rpc
      this.config = {
        type: RpcType.http,
        url: rpcUrl,
      }
    } else {
      throw new Error(`Unsupported RPC protocol, only http(s) allowed`)
    }
  }

  get rpc() {
    if (!this._rpc) {
      this._rpc = new RpcClient(this.config)
    }
    return this._rpc
  }

  // Return a passthrough web3 instance
  get web3() {
    if (!this._web3) {
      this._web3 = new Web3(this.config.url)
    }
    return this._web3
  }
}
