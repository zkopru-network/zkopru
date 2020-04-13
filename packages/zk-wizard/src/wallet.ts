import { LightNode } from '@zkopru/core'

export class ZkWallet {
  zkopru: LightNode

  constructor(zkopru: LightNode) {
    this.zkopru = zkopru
  }
}
