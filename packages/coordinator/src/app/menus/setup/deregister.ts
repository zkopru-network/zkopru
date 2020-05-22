import chalk from 'chalk'
import { TransactionReceipt } from 'web3-core'
import App, { AppMenu, Context } from '../../app'

const { goTo, print } = App

export default class Deregister extends App {
  static code = AppMenu.DEREGISTER

  async run(context: Context): Promise<Context> {
    print(chalk.blue)('Deregistering...')
    let receipt!: TransactionReceipt
    try {
      receipt = await this.coordinator.deregister()
    } catch (err) {
      print(chalk.red)(err)
    } finally {
      if (receipt && receipt.status) {
        print(chalk.green)('Successfully deregistered')
      } else {
        print(chalk.red)('Failed to deregister')
      }
    }
    return {
      ...goTo(context, AppMenu.SETUP_MENU),
    }
  }
}
