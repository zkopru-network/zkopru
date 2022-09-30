import { Balance } from '@zkopru/zk-wizard'
import { logger } from '@zkopru/utils'
import { formatUnits } from 'ethers/lib/utils'
import App, { AppMenu, Context } from '..'

export default class AccountDetail extends App {
  static code = AppMenu.ACCOUNT_DETAIL

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<{ context: Context; next: number }> {
    const wallet = this.base
    const { account } = context
    if (!account) {
      this.print('Account is not set, try to execute cli/wallet again')
      return { next: AppMenu.TOP_MENU, context }
    }
    let balance: Balance
    try {
      balance = await wallet.fetchLayer1Assets(account)
    } catch (err) {
      this.print('failed to fetch L1 account info')
      logger.error(err as any)
      return { next: AppMenu.TOP_MENU, context }
    }
    const spendables = await wallet.getSpendableAmount(account)
    const messages: string[] = []
    const { eth, erc20, erc721 } = balance
    messages.push(`Layer 1`)
    messages.push(`   Address: ${account.ethAddress}`)
    messages.push(`   Ether: ${formatUnits(eth, 'ether')}`)
    messages.push(`   ERC20: ${Object.keys(erc20).length === 0 ? 'N/A' : ''}`)
    messages.push(
      ...Object.keys(erc20).map(addr => `      ${addr}: ${erc20[addr]}`),
    )
    messages.push(`   ERC721: ${Object.keys(erc721).length === 0 ? 'N/A' : ''}`)
    messages.push(
      ...Object.keys(erc721).map(addr => `      ${addr}: ${erc721[addr]}`),
    )
    messages.push(`Layer 2`)
    messages.push(`   Pub key: ${account.zkAddress.toString()}`)
    messages.push(`   Ether: ${formatUnits(spendables.eth, 'ether')}`)
    messages.push(
      `   ERC20: ${Object.keys(spendables.erc20).length === 0 ? 'N/A' : ''}`,
    )
    messages.push(
      ...Object.keys(spendables.erc20).map(
        addr => `    ${addr} : ${spendables.erc20[addr]}`,
      ),
    )
    messages.push(
      `   ERC721: ${Object.keys(spendables.erc721).length === 0 ? 'N/A' : ''}`,
    )
    messages.push(
      ...Object.keys(spendables.erc721).map(
        addr => `    ${addr} : ${spendables.erc721[addr]}`,
      ),
    )
    this.print(messages.join('\n'))
    const { choice } = await this.ask({
      type: 'select',
      name: 'choice',
      initial: 0,
      message: 'What do you want to do?',
      choices: [
        { title: 'Go to top menu', value: AppMenu.TOP_MENU },
        { title: 'Deposit', value: AppMenu.DEPOSIT },
        { title: 'Transfer', value: AppMenu.TRANSFER },
        { title: 'Atomic swap', value: AppMenu.ATOMIC_SWAP },
        { title: 'Withdraw request', value: AppMenu.WITHDRAW_REQUEST },
        { title: 'Withdraw out', value: AppMenu.WITHDRAWABLE_LIST },
      ],
    })
    return { next: choice, context: { ...context, balance } }
  }
}
