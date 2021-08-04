import { SomeDBConnector, SQLiteConnector } from '@zkopru/database/dist/node'
import ZkopruNode from './zkopru-node'
import ZkopruWallet from './zkopru-wallet'
import RpcClient from './rpc-client'
import { NodeConfig } from './types'

/**

Zkopru
 - RPC
 - Node sync
 - Wallet management
 - Proving key management

* */

export default {
  RPC: RpcClient,
  // Default to the SQLiteConnector and export a function that is a constructor
  Node: function ZkopruNodeDB(config: NodeConfig, connector?: SomeDBConnector) {
    return new ZkopruNode(config, connector || SQLiteConnector)
  },
  Wallet: ZkopruWallet,
}

export { ZkAccount } from '@zkopru/account'
