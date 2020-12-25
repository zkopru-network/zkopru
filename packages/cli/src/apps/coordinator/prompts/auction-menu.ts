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
          value: AppMenu.UPDATE_URL,
        },
        {
          title: 'Set max bid',
          value: AppMenu.UPDATE_MAX_BID,
        }
      ]
    })
    switch (code) {
      default:
        return { context, next: code }
    }
  }
}
