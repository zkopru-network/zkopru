import { fromWei } from 'web3-utils'
import { Sum } from '@zkopru/transaction'
import App, { AppMenu, Context } from '..'

export default class AtomicSwap extends App {
  static code = AppMenu.ATOMIC_SWAP

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<{ context: Context; next: number }> {
    if (!context.account) throw Error('Acocunt is not set')
    const spendables: Sum = await this.base.getSpendableAmount(context.account)
    const locked: Sum = await this.base.getLockedAmount(context.account)
    const { choice } = await this.ask({
      type: 'select',
      name: 'choice',
      initial: 0,
      message: 'What will you give?',
      choices: [
        { title: 'Go back', value: { menu: AppMenu.ACCOUNT_DETAIL } },
        {
          title: `Ether (balance: ${fromWei(
            spendables.eth,
            'ether',
          )} ETH / locked: ${fromWei(locked.eth, 'ether')} ETH)`,
          value: { menu: AppMenu.ATOMIC_SWAP_GIVE_ETH },
        },
        ...Object.keys(spendables.erc20).map(address => ({
          title: `ERC20 - ${address} : ${spendables.erc20[address]}`,
          value: { menu: AppMenu.TOP_MENU, address },
        })),
        ...Object.keys(spendables.erc721).map(address => ({
          title: `ERC721 - ${address} : ${spendables.erc721[address].length}`,
          value: { menu: AppMenu.TOP_MENU, address },
        })),
      ],
    })
    return {
      next: choice.menu,
      context: { ...context, address: choice.address },
    }
  }
}
