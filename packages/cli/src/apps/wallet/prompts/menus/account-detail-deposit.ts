import { Balance } from '@zkopru/zk-wizard'
import { BigNumber } from 'ethers/lib/ethers'
import { formatEther } from 'ethers/lib/utils'
import App, { AppMenu, Context } from '..'

export default class Deposit extends App {
  static code = AppMenu.DEPOSIT

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<{ context: Context; next: number }> {
    if (!context.account) throw Error('Account is not set')
    const balance: Balance = await this.base.fetchLayer1Assets(context.account)
    const { choice } = await this.ask({
      type: 'select',
      name: 'choice',
      initial: 0,
      message: 'What do you want to do?',
      choices: [
        { title: 'Go back', value: { menu: AppMenu.ACCOUNT_DETAIL } },
        {
          title: `Ether (balance: ${formatEther(
            BigNumber.from(balance.eth),
          )} ETH)`,
          value: { menu: AppMenu.DEPOSIT_ETHER },
        },
        ...Object.keys(balance.erc721).map(address => ({
          title: `ERC20 to the zkopru network ${address} : ${balance.erc721[address]}`,
          value: { menu: AppMenu.DEPOSIT_ERC20, address },
        })),
        ...Object.keys(balance.erc721).map(address => ({
          title: `ERC721 to the zkopru network ${address} : ${balance.erc721[address]}`,
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
