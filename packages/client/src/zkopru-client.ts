/* eslint-disable no-underscore-dangle */
import Web3 from 'web3'
import { IndexedDBConnector, DB, schema } from '@zkopru/database/dist/web'
import { FullNode } from '@zkopru/core'
import RpcClient from './rpc-client'
import { RpcConfig, RpcType } from './types'

type Config = {
  address?: string
  bootstrap?: boolean
  websocket?: string
  rpcUrl?: string
}

const DEFAULT = {
  address: '0x24A8072a8d2fde1e22b99398a104640f58C8462d',
  bootstrap: true,
  // websocket: 'wss://goerli.infura.io/ws/v3/5b122dbc87ed4260bf9a2031e8a0e2aa',
  websocket: 'ws://192.168.1.199:9546',
}

export default class ZkopruClient {
  rpcConfig?: RpcConfig

  config: Config

  private _web3?: Web3

  private _rpc?: RpcClient

  private _db?: DB

  private node?: FullNode

  constructor(_config: Config) {
    this.config = {
      ...DEFAULT,
      ...(_config || {}),
    }
    if (this.config.rpcUrl && this.config.rpcUrl.indexOf('http') === 0) {
      // http rpc
      this.rpcConfig = {
        type: RpcType.http,
        url: this.config.rpcUrl,
      }
    } else if (this.config.rpcUrl) {
      throw new Error(`Unsupported RPC protocol, only http(s) allowed`)
    }
  }

  static async create(config: Config) {
    const client = new this(config)
    client._db = await IndexedDBConnector.create(schema)
    if (!client.config.websocket) {
      throw new Error('No websocket provided')
    }
    const provider = new Web3.providers.WebsocketProvider(
      client.config.websocket,
      {
        reconnect: {
          delay: 2000,
          auto: true,
        },
        clientConfig: {
          keepalive: true,
          keepaliveInterval: 30000,
        },
      },
    )
    async function waitConnection(_provider) {
      return new Promise<void>(res => {
        if (_provider.connected) return res()
        _provider.on('connect', res)
      })
    }
    provider.connect()
    await waitConnection(provider)
    await new Promise(r => setTimeout(r, 1000))
    client.node = await FullNode.new({
      address: DEFAULT.address,
      provider,
      db: client._db,
    })
    return client
  }

  async start() {
    if (!this.node) throw new Error('Node is not initialized')
    this.node.start()
  }

  get rpc() {
    if (!this.rpcConfig) {
      throw new Error('No rpc config supplied')
    }
    if (!this._rpc) {
      this._rpc = new RpcClient(this.rpcConfig)
    }
    return this._rpc
  }

  // Return a passthrough web3 instance
  get web3() {
    if (!this._web3) {
      this._web3 = new Web3(
        (this.config.websocket || this.config.rpcUrl) as any,
      )
    }
    return this._web3
  }
}
