import { ZkAccount } from '@zkopru/account'
import App, { AppMenu, Context } from '../app'

const { goTo } = App

export default class TopMenu extends App {
  static code = AppMenu.TOP_MENU

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<Context> {
    const accounts: ZkAccount[] = await this.zkWallet.wallet.retrieveAccounts()
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
          title: 'Create new account',
          value: -1,
        },
        {
          title: 'Quit',
          value: -2,
        },
      ],
    })
    let reRun: Context
    switch (idx) {
      case -1:
        await this.zkWallet.wallet.createAccount(accounts.length)
        reRun = await this.run(context)
        return reRun
      case -2:
        return { ...goTo(context, AppMenu.EXIT) }
      default:
        this.zkWallet.setAccount(idx)
        return {
          ...goTo(context, AppMenu.ACCOUNT_DETAIL),
          account: accounts[idx],
        }
    }
  }
}
