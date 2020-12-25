import { WithdrawalStatus } from '@zkopru/transaction'
import App, { AppMenu, Context } from '..'
import { fromWei } from 'web3-utils'

export default class WithdrawableList extends App {
  static code = AppMenu.WITHDRAWABLE_LIST

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<{ context: Context; next: number }> {
    if (!context.account) throw Error('Account is not set')
    const unfinalized = await this.base.getWithdrawables(
      context.account,
      WithdrawalStatus.UNFINALIZED,
    )
    const finalized = await this.base.getWithdrawables(
      context.account,
      WithdrawalStatus.WITHDRAWABLE,
    )
    const { choice } = await this.ask({
      type: 'select',
      name: 'choice',
      initial: 0,
      message: 'What do you want to do?',
      choices: [
        {
          title: 'Go back',
          value: { menu: AppMenu.ACCOUNT_DETAIL, withdrawal: undefined },
        },
        ...unfinalized.map(w => ({
          title: `Not finalized yet - instant withdraw?
          ETH: ${fromWei(w.eth, 'ether')}
          ERC20: ${w.erc20Amount}
          NFT: ${w.nft}`,
          value: { menu: AppMenu.INSTANT_WITHDRAW, withdrawal: w },
        })),
        ...finalized.map(w => ({
          title: `finalized - withdraw now?
          ETH: ${fromWei(w.eth, 'ether')}
          ERC20: ${w.erc20Amount}
          NFT: ${w.nft}`,
          value: { menu: AppMenu.WITHDRAW, withdrawal: w },
        })),
      ],
    })
    return {
      next: choice.menu,
      context: { ...context, withdrawal: choice.withdrawal },
    }
  }
}
