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
    prerequesites?: TransactionObject<any>[],
  ): Promise<boolean> {
    logger.trace('core/watchdog - Watchdog::slash()')
    if (prerequesites) {
      logger.info(`core/watchdog - Prerequisite txs exist.`)
      for (const tx of prerequesites) {
        const receipt = await this.layer1.sendTx(tx, this.account)
        logger.info(
          `core/watchdog - Preparing a slash / Tx ID: ${receipt?.transactionHash}.`,
        )
        if (!receipt?.status || !receipt) {
          logger.error(
            `core/watchdog - Failed to execute a prerequisite tx: ${receipt?.transactionHash}.`,
          )
          return false
        }
      }
    }
    try {
      const receipt = await this.layer1.sendTx(slashTx, this.account)
      logger.info(
        `core/watchdog - Preparing a slash / Tx ID: ${receipt?.transactionHash}.`,
      )
      return receipt?.status || false
    } catch (err) {
      return false
    }
  }
}
