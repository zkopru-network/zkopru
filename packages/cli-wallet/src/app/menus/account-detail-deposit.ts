import { fromWei } from 'web3-utils'
import App, { AppMenu, Context } from '../app'
import { Balance } from '../../zk-wallet'

const { goTo } = App

export default class Deposit extends App {
  static code = AppMenu.DEPOSIT

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<Context> {
    if (!context.account) throw Error('Acocunt is not set')
    const balance: Balance = await this.zkWallet.getLayer1Assets(
      context.account,
    )
    const { choice } = await this.ask({
      type: 'select',
      name: 'choice',
      initial: 0,
      message: 'What do you want to do?',
      choices: [
        { title: 'Go back', value: { menu: AppMenu.ACCOUNT_DETAIL } },
        {
          title: `Ether (balance: ${fromWei(balance.eth, 'ether')} ETH)`,
          value: { menu: AppMenu.DEPOSIT_ETHER },
        },
        ...Object.keys(balance.erc721).map(address => ({
          title: `ERC20 to the zkopru netwokr ${address} : ${balance.erc721[address]}`,
          value: { menu: AppMenu.DEPOSIT_ERC20, address },
        })),
        ...Object.keys(balance.erc721).map(address => ({
          title: `ERC721 to the zkopru network ${address} : ${balance.erc721[address]}`,
          value: { menu: AppMenu.DEPOSIT_ERC721, address },
        })),
      ],
    })
    return { ...goTo(context, choice.menu), address: choice.address }
  }
}
