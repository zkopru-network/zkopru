import chalk from 'chalk'
import App, { AppMenu, Context } from '../app'

const { goTo, print } = App

export default class AccountDetail extends App {
  static code = AppMenu.ACCOUNT_DETAIL

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<Context> {
    if (!context.account) throw Error('Acocunt is not set')
    const spendables = await this.zkWallet.getSpendables(context.account)
    print(chalk.greenBright)(
      `Ether: ${spendables.eth.divn(18).toString()} Ether`,
    )
    const { choice } = await this.ask({
      type: 'select',
      name: 'choice',
      initial: 0,
      message: 'What do you want to do?',
      choices: [
        { title: 'Go to top menu', value: AppMenu.TOP_MENU },
        {
          title: 'Deposit Ether to the zkopru network',
          value: AppMenu.DEPOSIT_ETHER,
        },
      ],
    })
    return { ...goTo(context, choice) }
  }
}
