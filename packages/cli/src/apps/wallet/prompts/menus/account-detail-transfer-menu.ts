import { Sum } from '@zkopru/transaction'
import { formatUnits } from 'ethers/lib/utils'
import App, { AppMenu, Context } from '..'

export default class TransferMenu extends App {
  static code = AppMenu.TRANSFER

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
          title: `Ether (balance: ${formatUnits(
            spendables.eth,
            'ether',
          )} ETH / locked: ${formatUnits(locked.eth, 'ether')} ETH)`,
          value: { menu: AppMenu.TRANSFER_ETH },
        },
        ...Object.keys(spendables.erc20).map(address => ({
          title: `ERC20 to the zkopru netwokr ${address} : ${spendables.erc20[address]}`,
          value: { menu: AppMenu.DEPOSIT_ERC20, address },
        })),
        ...Object.keys(spendables.erc721).map(address => ({
          title: `ERC721 to the zkopru network ${address} : ${spendables.erc721[address].length}`,
          value: { menu: AppMenu.DEPOSIT_ERC721, address },
        })),
      ],
    })
    return {
      next: choice.menu,
      context: { ...context, address: choice.address },
    }
  }
}
