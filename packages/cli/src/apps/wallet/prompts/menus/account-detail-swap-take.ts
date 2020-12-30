import App, { AppMenu, Context } from '..'

export default class AtomicSwapTake extends App {
  static code = AppMenu.ATOMIC_SWAP_TAKE

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<{ context: Context; next: number }> {
    if (!context.account) throw Error('Account is not set')
    const { choice } = await this.ask({
      type: 'select',
      name: 'choice',
      initial: 0,
      message: 'What will you take?',
      choices: [
        { title: 'Go back', value: { menu: AppMenu.ACCOUNT_DETAIL } },
        {
          title: `Ether`,
          value: { menu: AppMenu.ATOMIC_SWAP_TAKE_ETH },
        },
        // ...Object.keys(balance.erc721).map(address => ({
        //   title: `ERC20 - ${address} : ${balance.erc721[address]}`,
        //   value: { menu: AppMenu.DEPOSIT_ERC20, address },
        // })),
        // ...Object.keys(balance.erc721).map(address => ({
        //   title: `ERC721 - ${address} : ${balance.erc721[address]}`,
        //   value: { menu: AppMenu.DEPOSIT_ERC721, address },
        // })),
      ],
    })
    return {
      next: choice.menu,
      context: { ...context, address: choice.address },
    }
  }
}
