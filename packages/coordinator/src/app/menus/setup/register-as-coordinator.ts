import chalk from 'chalk'
import { TransactionReceipt } from 'web3-core'
import App, { AppMenu, Context } from '../../app'

const { goTo, print } = App

export default class RegisterAsCoordinator extends App {
  static code = AppMenu.REGISTER_AS_COORDINATOR

  async run(context: Context): Promise<Context> {
    print(chalk.blue)('Registering as a coordinator')
    let receipt!: TransactionReceipt
    try {
      receipt = await this.coordinator.registerAsCoordinator()
    } catch (err) {
      print(chalk.red)(err)
    } finally {
      if (receipt && receipt.status) {
        print(chalk.green)('Successfully registered as a coordinator')
      } else {
        print(chalk.red)('Failed to register as a coordinator')
      }
    }
    return {
      ...goTo(context, AppMenu.SETUP_MENU),
    }
  }
}
