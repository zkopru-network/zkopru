import { ZkAccount } from '@zkopru/account'
import App, { AppMenu, Context } from '..'

export default class TopMenu extends App {
  static code = AppMenu.TOP_MENU

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<{ context: Context; next: number }> {
    const accounts: ZkAccount[] = await this.base.retrieveAccounts()
    const { idx } = await this.ask({
      type: 'select',
      name: 'idx',
      message: 'Which account do you want to use?',
      choices: [
        ...accounts.map((obj, i) => ({
          title: obj.ethAddress,
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
    let reRun: { context: Context; next: number }
    switch (idx) {
      case -1:
        await this.base.createAccount(accounts.length)
        reRun = await this.run(context)
        return reRun
      case -2:
        return { context, next: AppMenu.EXIT }
      default:
        this.base.setAccount(accounts[idx])
        return {
          context: { ...context, account: accounts[idx] },
          next: AppMenu.ACCOUNT_DETAIL,
        }
    }
  }
}
