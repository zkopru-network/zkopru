import { Node } from '@zkopru/core'

export class ZkWallet {
  zkopru: Node

  constructor(zkopru: Node) {
    this.zkopru = zkopru
  }
}
