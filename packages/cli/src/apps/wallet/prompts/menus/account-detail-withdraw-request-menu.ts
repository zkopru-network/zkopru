import { Sum } from '@zkopru/transaction'
import { formatUnits } from 'ethers/lib/utils'
import App, { AppMenu, Context } from '..'

export default class WithdrawRequest extends App {
  static code = AppMenu.WITHDRAW_REQUEST

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<{ context: Context; next: number }> {
    if (!context.account) throw Error('Account is not set')
    const spendables: Sum = await this.base.getSpendableAmount(context.account)
    const locked: Sum = await this.base.getLockedAmount(context.account)
    const { choice } = await this.ask({
      type: 'select',
      name: 'choice',
      initial: 0,
      message: 'What do you want to do?',
      choices: [
        { title: 'Go back', value: { menu: AppMenu.ACCOUNT_DETAIL } },
        {
          title: `Withdraw Ether (balance: ${formatUnits(
            spendables.eth,
            'ether',
          )} ETH / locked: ${formatUnits(locked.eth, 'ether')} ETH)`,
          value: { menu: AppMenu.WITHDRAW_REQUEST_ETH },
        },
        ...Object.keys(spendables.erc20).map(address => ({
          title: `Withdraw ERC20 ${address} : ${spendables.erc20[address]}`,
          value: { menu: AppMenu.WITHDRAW_REQUEST_ERC20, address },
        })),
        ...Object.keys(spendables.erc721).map(address => ({
          title: `Withdraw NFT ${address} : ${spendables.erc721[address].length}`,
          value: { menu: AppMenu.WITHDRAW_REQUEST_ERC721, address },
        })),
      ],
    })
    return {
      next: choice.menu,
      context: { ...context, address: choice.address },
    }
  }
}
