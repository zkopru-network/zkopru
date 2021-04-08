// import { ZkWallet } from '@zkopru/zk-wizard'
import { ZkAccount } from '@zkopru/account'
import ZkopruNode from './zkopru-node'

export default class ZkopruWallet {
  node: ZkopruNode

  // wallet: ZkopruWallet
  account: ZkAccount

  constructor(node: ZkopruNode, privateKey: Buffer | string) {
    this.node = node
    this.account = new ZkAccount(privateKey)
    // this.wallet = new ZkopruWallet({
    //   db: this.node._db,
    //   node: node.node,
    //   accounts: [],
    // })
  }
}
