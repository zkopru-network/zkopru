import { SomeDBConnector, IndexedDBConnector } from '@zkopru/database/dist/web'
import { ZkAddress } from '@zkopru/transaction'
import ZkopruNode from './zkopru-node'
import ZkopruWallet from './zkopru-wallet'
import RpcClient from './rpc-client'
import { NodeConfig } from './types'

export default {
  RPC: RpcClient,
  Node: function ZkopruNodeDB(config: NodeConfig, connector?: SomeDBConnector) {
    return new ZkopruNode(config, connector || IndexedDBConnector)
  },
  Wallet: ZkopruWallet,
  ZkAddress,
}
