import chalk from 'chalk'
import { ZkAccount } from '@zkopru/account'
import Configurator, { Context, Menu } from '../configurator'

export default class TrackingAccount extends Configurator {
  static code = Menu.CONFIG_TRACKING_ACCOUNT

  async run(context: Context): Promise<{ context: Context; next: number }> {
    if (!context.wallet) {
      throw Error(chalk.red('Wallet is not loaded'))
    }
    if (this.base.numberOfAccounts) {
      await Promise.all(
        Array(this.base.numberOfAccounts).map((_, index) =>
          context.wallet?.createAccount(index),
        ),
      )
      return { context, next: Menu.LOAD_NODE }
    }
    let message = ``
    this.print(chalk.blue('List of tracking accounts'))
    const accounts: ZkAccount[] = await context.wallet.retrieveAccounts()
    message = accounts.reduce(
      (val, account, idx) => `${val}\n${idx}: ${account.ethAddress}`,
      message,
    )
    this.print(message)
    if (!context.isInitialSetup) {
      return { context: { ...context, accounts }, next: Menu.LOAD_NODE }
    }
    const { idx } = await this.ask({
      type: 'select',
      name: 'idx',
      message: 'This node will keep tracking on the utxos for these accounts.',
      choices: [
        {
          title: 'Create a new account',
          value: 0,
        },
        {
          title: 'Proceed to the next step',
          value: 1,
        },
      ],
    })
    let reRun: { context: Context; next: number }
    switch (idx) {
      case 0:
        await context.wallet.createAccount(accounts.length)
        reRun = await this.run(context)
        return reRun
      case 1:
        return { context: { ...context, accounts }, next: Menu.LOAD_NODE }
      default:
        return { context: { ...context, accounts }, next: Menu.EXIT }
    }
  }
}
