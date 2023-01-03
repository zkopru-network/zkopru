/* eslint-disable no-underscore-dangle */
import { SomeDBConnector, DB, schema } from '@zkopru/database'
import { FullNode } from '@zkopru/core'
import { ERC20__factory } from '@zkopru/contracts'
import {
  BaseProvider,
  JsonRpcProvider,
  WebSocketProvider,
} from '@ethersproject/providers'
import { NodeConfig } from './types'

const DEFAULT = {
  address:
    process.env.ZKOPRU_ADDRESS || '0x48458C823DF628f0C053B0786d4111529B9fB7B0',
  bootstrap: true,
  websocket:
    process.env.ZKOPRU_WEBSOCKET ||
    'wss://goerli.infura.io/ws/v3/5b122dbc87ed4260bf9a2031e8a0e2aa',
}

export default class ZkopruNode {
  config: NodeConfig

  _db?: DB

  node?: FullNode

  private connectorType: SomeDBConnector

  constructor(_config: NodeConfig, connectorType: SomeDBConnector) {
    this.config = {
      ...DEFAULT,
      ...(_config || {}),
    }
    this.connectorType = connectorType
    if (!this.config.websocket) {
      throw new Error('No websocket provided')
    }
  }

  get isRunning() {
    return this.node?.isRunning()
  }

  private async initDB(...args: any[]) {
    if (!this._db) {
      const databaseName = `zkopru-${
        this.config.chainId
      }-${this.config.address?.slice(2)}`
      this._db = await this.connectorType.create(schema, databaseName, ...args)
    }
  }

  private async db(...args: any[]) {
    await this.initDB(...args)
    return this._db as DB
  }

  async initNode(...args: any[]) {
    if (this.node) return

    const provider = this.config.websocket
      ? new WebSocketProvider(this.config.websocket as string)
      : new JsonRpcProvider(this.config.rpcUrl)
    // eslint-disable-next-line no-inner-declarations
    async function waitConnection(_provider: BaseProvider) {
      let count = 0
      for (;;) {
        const ready = await _provider.ready
        if (ready) return
        await new Promise(r => setTimeout(r, 200))
        count += 1
        if (count > 100) {
          throw new Error('Connection timed out')
        }
      }
    }
    await waitConnection(provider)
    await new Promise(r => setTimeout(r, 1000))
    const web3 = new Web3(provider)
    this.config.chainId = await web3.eth.getChainId()
    this.node = await FullNode.new({
      address: this.config.address as string,
      provider,
      db: await this.db(...args),
      accounts: this.config.accounts,
    })
  }

  // Accept database configuration here
  async start(...args: any[]) {
    await this.initNode(...args)
    if (!this.node) {
      throw new Error('Node is not initialized')
    }
    this.node.start()
  }

  async stop() {
    if (!this.node) return
    await this.node.stop()
    delete this.node
  }

  // clear all blockchain info and prepare for complete resync
  async resetDB() {
    const db = await this.db()
    await db.transaction(_db => {
      _db.delete('Config', { where: {} })
      _db.delete('Tracker', { where: {} })
      _db.delete('Header', { where: {} })
      _db.delete('Block', { where: {} })
      _db.delete('Proposal', { where: {} })
      _db.delete('Slash', { where: {} })
      _db.delete('Bootstrap', { where: {} })
      _db.delete('Tx', { where: {} })
      _db.delete('PendingTx', { where: {} })
      _db.delete('MassDeposit', { where: {} })
      _db.delete('Deposit', { where: {} })
      _db.delete('Utxo', { where: {} })
      _db.delete('Withdrawal', { where: {} })
      _db.delete('Migration', { where: {} })
      _db.delete('TreeNode', { where: {} })
      _db.delete('LightTree', { where: {} })
      _db.delete('TokenRegistry', { where: {} })
    })
  }

  async registerERC20Tx(address: string) {
    if (!this.node) throw new Error('Zkopru node is not initialized')
    return this.node.layer1.coordinator.registerERC20(address)
  }

  async getERC20Contract(address: string) {
    if (!this.node) throw new Error('Zkopru node is not initialized')
    return ERC20__factory.connect(address, this.node.layer1.provider)
  }
}
