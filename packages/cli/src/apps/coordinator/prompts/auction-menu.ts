// import chalk from 'chalk'
import App, { AppMenu, Context } from '.'

export default class AuctionMenu extends App {
  static code = AppMenu.AUCTION_MENU

  async run(context: Context): Promise<{ context: Context; next: number }> {
    const { code } = await this.ask({
      type: 'select',
      name: 'code',
      message: 'Select menu',
      choices: [
        {
          title: '..',
          value: AppMenu.TOP_MENU,
        },
        {
          title: 'Update URL',
          value: AppMenu.AUCTION_UPDATE_URL,
        },
        {
          title: 'Set max bid',
          value: AppMenu.AUCTION_UPDATE_MAX_BID,
        },
        {
          title: 'Refund balance',
          value: AppMenu.AUCTION_REFUND,
        },
      ],
    })
    switch (code) {
      default:
        return { context, next: code }
    }
  }
}
