import chalk from 'chalk'
import { TransactionReceipt } from '@ethersproject/providers'
import { logger } from '@zkopru/utils'
import App, { AppMenu, Context } from '..'

export default class RegisterAsCoordinator extends App {
  static code = AppMenu.REGISTER_AS_COORDINATOR

  async run(context: Context): Promise<{ context: Context; next: number }> {
    this.print(chalk.blue('Registering as a coordinator'))
    let receipt: TransactionReceipt | undefined
    try {
      receipt = await this.base.registerAsCoordinator()
    } catch (err) {
      if (err instanceof Error) this.print(chalk.red(err.message))
      logger.error(err as any)
    } finally {
      if (receipt && receipt.status) {
        this.print(chalk.green('Successfully registered as a coordinator'))
      } else {
        this.print(chalk.red('Failed to register as a coordinator'))
      }
    }
    return { context, next: AppMenu.SETUP_MENU }
  }
}
