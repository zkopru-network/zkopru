import { ZkWalletAccount } from '@zkopru/zk-wizard'
import ZkopruNode from './zkopru-node'

// The ipfs path for the latest proving keys
const DEFAULT_KEY_CID = '/ipfs/QmWdQnPVdbS61ERWJY76xfkbzrLDiQptE81LRTQUupSP7G'

export default class ZkopruWallet {
  node: ZkopruNode

  wallet: ZkWalletAccount

  constructor(
    node: ZkopruNode,
    privateKey: Buffer | string,
    coordinator: string,
  ) {
    this.node = node
    if (!this.node.node) {
      throw new Error('ZkopruNode does not have a full node initialized')
    }
    this.wallet = new ZkWalletAccount({
      privateKey,
      node: this.node.node,
      snarkKeyCid: DEFAULT_KEY_CID,
      coordinator,
      // TODO: pre-written list or retrieve from remote
      erc20: [],
      erc721: [],
    })
  }
}
