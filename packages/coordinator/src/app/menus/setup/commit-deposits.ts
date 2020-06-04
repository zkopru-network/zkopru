import chalk from 'chalk'
import { TransactionReceipt } from 'web3-core'
import App, { AppMenu, Context } from '../../app'

const { goTo, print } = App

export default class CommitDeposits extends App {
  static code = AppMenu.COMMIT_DEPOSITS

  async run(context: Context): Promise<Context> {
    print(chalk.blue)('Commit depostis')
    let receipt!: TransactionReceipt
    try {
      receipt = await this.coordinator.commitMassDeposit()
    } catch (err) {
      print(chalk.red)(err)
    } finally {
      if (receipt && receipt.status) {
        print(chalk.green)('Successfully committed the latest mass deposit')
      } else {
        print(chalk.red)('Failed to commit the latest mass deposit')
      }
    }
    return {
      ...goTo(context, AppMenu.SETUP_MENU),
    }
  }
}
