import { logger } from '@zkopru/utils'
import { TransactionRequest } from '@ethersproject/providers'
import { Signer } from 'ethers'
import { L1Contract } from '../context/layer1'

export class Watchdog {
  layer1: L1Contract

  account: Signer

  constructor(layer1: L1Contract, account: Signer) {
    account.getAddress().then(accountAddr => {
      logger.trace(
        `core/watchdog - Watchdog::constructor(${layer1.address}, ${accountAddr})`,
      )
    })
    this.layer1 = layer1
    this.account = account
  }

  async slash(
    slashTx: TransactionRequest,
    prerequesites?: TransactionRequest[],
  ): Promise<boolean> {
    logger.trace('core/watchdog - Watchdog::slash()')
    if (prerequesites) {
      logger.info(`core/watchdog - Prerequisite txs exist.`)
      for (const tx of prerequesites) {
        const txResponse = await this.account.sendTransaction(tx)
        logger.info(
          `core/watchdog - Preparing a slash / Tx ID: ${txResponse.hash}.`,
        )
        const receipt = await txResponse.wait()
        if (!receipt.status || !receipt) {
          logger.error(
            `core/watchdog - Failed to execute a prerequisite tx: ${receipt?.transactionHash}.`,
          )
          return false
        }
      }
    }
    try {
      const txResponse = await this.account.sendTransaction(slashTx)
      logger.info(
        `core/watchdog - Preparing a slash / Tx ID: ${txResponse?.hash}.`,
      )
      const receipt = await txResponse.wait()
      return !!receipt.status || false
    } catch (err) {
      logger.error(`core/watchdog - Error executing slash`)
      logger.error(err as any)
      return false
    }
  }
}
