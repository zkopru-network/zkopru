import chalk from 'chalk'
import { ZkAccount } from '@zkopru/account'
import Configurator, { Context, Menu } from '../configurator'

const { print, goTo } = Configurator

export default class TrackingAccount extends Configurator {
  static code = Menu.CONFIG_TRACKING_ACCOUNT

  async run(context: Context): Promise<Context> {
    if (!context.wallet) {
      throw Error(chalk.red('Wallet is not loaded'))
    }
    print(chalk.blue)('Configure accounts to keep tracking')
    print(chalk.blue)('My account list')
    if (this.config.accountNumber) {
      await Promise.all(
        Array(this.config.accountNumber).map((_, index) =>
          context.wallet?.createAccount(index),
        ),
      )
      return { ...goTo(context, Menu.SAVE_CONFIG) }
    }
    const accounts: ZkAccount[] = await context.wallet.retrieveAccounts()
    accounts.forEach((account, i) => print()(`${i}: ${account.address}`))
    if (!context.isInitialSetup) {
      return { ...goTo(context, Menu.SAVE_CONFIG), accounts }
    }
    const { idx } = await this.ask({
      type: 'select',
      name: 'idx',
      message: 'This node will keep tracking on the utxos for these accounts.',
      choices: [
        {
          title: 'Create new account',
          value: 0,
        },
        {
          title: 'Proceed next step',
          value: 1,
        },
      ],
    })
    let reRun: Context
    switch (idx) {
      case 0:
        await context.wallet.createAccount(accounts.length)
        reRun = await this.run(context)
        return reRun
      case 1:
        return { ...goTo(context, Menu.SAVE_CONFIG), accounts }
      default:
        return { ...goTo(context, Menu.EXIT), accounts }
    }
  }
}
