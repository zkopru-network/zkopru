import chalk from 'chalk'
import { ZkAccount } from '@zkopru/account'
import App, { Context, Menu } from '../app'

const { print, goTo } = App

export default class TrackingAccount extends App {
  async run(context: Context): Promise<Context> {
    if (!context.wallet) {
      throw Error(chalk.red('Wallet is not loaded'))
    }
    print(chalk.blue)('Configure accounts to keep tracking')
    print(chalk.blue)('My account list')
    const accounts: ZkAccount[] = await context.wallet.retrieveAccounts()
    accounts.forEach((account, i) => print()(`${i}: ${account.address}`))
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
        return { ...goTo(context, Menu.LOAD_NODE), accounts }
      default:
        return { ...goTo(context, Menu.EXIT), accounts }
    }
  }
}
