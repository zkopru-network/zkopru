import { Account } from 'web3-core'
import { TransactionObject } from '@zkopru/contracts'
import { logger } from '@zkopru/utils'
import { L1Contract } from '../context/layer1'

export class Watchdog {
  layer1: L1Contract

  account: Account

  constructor(layer1: L1Contract, account: Account) {
    logger.trace(
      `core/watchdog - Watchdog::constructor(${layer1.address}, ${account.address})`,
    )
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
    logger.trace('core/watchdog - Watchdog::slash()')
    try {
      const receipt = await this.layer1.sendTx(slashTx, this.account)
      return receipt?.status || false
    } catch (err) {
      return false
    }
  }
}
