import chalk from 'chalk'
import { TransactionReceipt } from '@ethersproject/providers'
import { logger } from '@zkopru/utils'
import App, { AppMenu, Context } from '..'

export default class Deregister extends App {
  static code = AppMenu.DEREGISTER

  async run(context: Context): Promise<{ context: Context; next: number }> {
    this.print('Deregistering...')
    let receipt: TransactionReceipt | undefined
    try {
      receipt = await this.base.deregister()
    } catch (err) {
      logger.error(err as any)
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
