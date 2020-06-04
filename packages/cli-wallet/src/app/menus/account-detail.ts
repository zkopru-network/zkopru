import chalk from 'chalk'
import { fromWei } from 'web3-utils'
import { Balance } from '../../zk-wallet'
import App, { AppMenu, Context } from '../app'

const { goTo, print } = App

export default class AccountDetail extends App {
  static code = AppMenu.ACCOUNT_DETAIL

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<Context> {
    if (!context.account) throw Error('Acocunt is not set')
    const balance: Balance = await this.zkWallet.getLayer1Assets(
      context.account,
    )
    const spendables = await this.zkWallet.getSpendables(context.account)
    print(chalk.yellowBright)('Layer 1')
    print(chalk.greenBright)(`   Ether: ${fromWei(balance.eth, 'ether')}`)
    Object.keys(balance.erc20).forEach(addr => {
      print(chalk.greenBright)(`    ERC20 @ ${addr} : ${balance.erc20[addr]}`)
    })
    Object.keys(balance.erc721).forEach(addr => {
      print(chalk.greenBright)(`    ERC721 @ ${addr} : ${balance.erc721[addr]}`)
    })
    print()()
    print(chalk.yellowBright)('Layer 2')
    print(chalk.greenBright)(
      `   Ether: ${fromWei(spendables.eth, 'ether')} Ether`,
    )
    Object.keys(spendables.erc20).forEach(addr => {
      print(chalk.greenBright)(`    ERC20 @ ${addr} : ${balance.erc721[addr]}`)
    })
    Object.keys(spendables.erc721).forEach(addr => {
      print(chalk.greenBright)(`    ERC721 @ ${addr} : ${balance.erc721[addr]}`)
    })
    const { choice } = await this.ask({
      type: 'select',
      name: 'choice',
      initial: 0,
      message: 'What do you want to do?',
      choices: [
        { title: 'Go to top menu', value: AppMenu.TOP_MENU },
        { title: 'Deposit', value: AppMenu.DEPOSIT },
        { title: 'Transfer', value: AppMenu.TRANSFER },
        { title: 'Withdraw', value: AppMenu.WITHDRAW },
      ],
    })
    return { ...goTo(context, choice), balance, spendables }
  }
}
