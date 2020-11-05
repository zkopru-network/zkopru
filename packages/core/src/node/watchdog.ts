import { Account } from 'web3-core'
import { TransactionObject } from '@zkopru/contracts'
import { L1Contract } from '../context/layer1'

export class Watchdog {
  layer1: L1Contract

  account: Account

  constructor(layer1: L1Contract, account: Account) {
    this.layer1 = layer1
    this.account = account
  }

  async slash(
    slashTx: TransactionObject<{
      slash: boolean
      reason: string
      0: boolean
      1: string
    }>,
  ): Promise<boolean> {
    try {
      const receipt = await this.layer1.sendTx(slashTx, this.account)
      return receipt?.status || false
    } catch (err) {
      return false
    }
  }
}
