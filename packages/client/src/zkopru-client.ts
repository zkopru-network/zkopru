/* eslint-disable no-underscore-dangle */
import Web3 from 'web3'
import RpcClient from './rpc-client'
import { RpcConfig, RpcType } from './types'
import { IndexedDBConnector, DB, schema } from '@zkopru/database'
import { FullNode } from '@zkopru/core'

const DEFAULT = {
  address: '0xCDD5C38A39fDC9C77fE3a72998d34c8Ce99d2d34',
  bootstrap: true,
  // websocket: 'wss://goerli.infura.io/ws/v3/5b122dbc87ed4260bf9a2031e8a0e2aa',
  websocket: 'ws://192.168.1.199:9546',
  maxBytes: 131072,
  priceMultiplier: 48,
  port: 8888,
  maxBid: 20000,
  daemon: false,
  vhosts: 'localhost,127.0.0.1',
}

export default class ZkopruClient {
  config: RpcConfig

  private _web3?: Web3

  private _rpc?: RpcClient

  private _db?: DB
  private _node?: FullNode

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

  static async create(url: string) {
    const client = new this(url)
    client._db = await IndexedDBConnector.create(schema)
    const provider = new Web3.providers.WebsocketProvider(DEFAULT.websocket, {
      reconnect: {
        delay: 2000,
        auto: true,
      },
      clientConfig: {
        keepalive: true,
        keepaliveInterval: 30000,
      },
    })
    async function waitConnection(_provider) {
      return new Promise<void>(res => {
        if (_provider.connected) return res()
        _provider.on('connect', res)
      })
    }
    provider.connect()
    await waitConnection(provider)
    await new Promise(r => setTimeout(r, 1000))
    client._node = await FullNode.new({
      address: DEFAULT.address,
      provider,
      db: client._db,
    })
    return client
  }

  async start() {
    this._node?.start()
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
