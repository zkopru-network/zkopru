import chalk from 'chalk'
import { TransactionReceipt } from 'web3-core'
import App, { AppMenu, Context } from '..'

export default class RegisterAsCoordinator extends App {
  static code = AppMenu.REGISTER_AS_COORDINATOR

  async run(context: Context): Promise<{ context: Context; next: number }> {
    this.print(chalk.blue('Registering as a coordinator'))
    let receipt!: TransactionReceipt
    try {
      receipt = await this.base.registerAsCoordinator()
    } catch (err) {
      this.print(chalk.red(err))
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
