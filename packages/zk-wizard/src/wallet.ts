import { ZkOPRU } from '@zkopru/core'

export class ZkWallet {
  zkopru: ZkOPRU

  constructor(zkopru: ZkOPRU) {
    this.zkopru = zkopru
  }
}
