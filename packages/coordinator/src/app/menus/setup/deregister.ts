import chalk from 'chalk'
import { TransactionReceipt } from 'web3-core'
import { logger } from '@zkopru/utils'
import App, { AppMenu, Context } from '../../app'

export default class Deregister extends App {
  static code = AppMenu.DEREGISTER

  async run(context: Context): Promise<{ context: Context; next: number }> {
    this.print('Deregistering...')
    let receipt!: TransactionReceipt
    try {
      receipt = await this.base.deregister()
    } catch (err) {
      logger.error(err)
    } finally {
      if (receipt && receipt.status) {
        this.print(chalk.green('Successfully deregistered'))
      } else {
        this.print(chalk.red('Failed to deregister'))
      }
    }
    return { context, next: AppMenu.SETUP_MENU }
  }
}
