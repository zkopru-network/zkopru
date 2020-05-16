import { ZkOPRUNode } from '@zkopru/core'
import Web3 from 'web3'
import { HDWallet } from '@zkopru/account'
import { InanoSQLInstance } from '@nano-sql/core'
import { Grove } from '@zkopru/tree'
import { ZkWizard } from './zk-wizard'

export class ZkOPRUWallet {
  web3: Web3

  db: InanoSQLInstance

  wallet: HDWallet

  grove: Grove

  node: ZkOPRUNode

  wizard: ZkWizard

  constructor({
    web3,
    db,
    wallet,
    grove,
    node,
    wizard,
  }: {
    web3: Web3

    db: InanoSQLInstance

    wallet: HDWallet

    grove: Grove

    node: ZkOPRUNode

    wizard: ZkWizard
  }) {
    this.web3 = web3
    this.db = db
    this.wallet = wallet
    this.grove = grove
    this.node = node
    this.wizard = wizard
  }

  // static async loadDevWallet(): Promise<ZkOPRUWallet> {
  //   return
  // }
}
