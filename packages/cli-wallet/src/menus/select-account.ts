import chalk from 'chalk'
import { ZkAccount } from '@zkopru/account'
import App, { Context, Menu } from '../app'

const { goTo } = App

export default class SelectAccount extends App {
  async run(context: Context): Promise<Context> {
    if (!context.wallet) {
      throw Error(chalk.red('Wallet is not loaded'))
    }
    const accounts: ZkAccount[] = await context.wallet.retrieveAccounts()
    const { idx } = await this.ask({
      type: 'select',
      name: 'idx',
      message: 'Which account do you want to use?',
      choices: [
        ...accounts.map((obj, i) => ({
          title: obj.address,
          value: i,
        })),
        {
          title: 'quit',
          value: -1,
        },
      ],
    })
    switch (idx) {
      case -1:
        return { ...goTo(context, Menu.EXIT) }
      default:
        return {
          ...goTo(context, Menu.ACCOUNT_DETAIL),
          account: accounts[idx],
        }
    }
  }
}
