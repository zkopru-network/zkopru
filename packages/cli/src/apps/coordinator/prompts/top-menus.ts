import App, { AppMenu, Context } from '.'

export default class TopMenu extends App {
  static code = AppMenu.TOP_MENU

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<{ context: Context; next: number }> {
    const { code } = await this.ask({
      type: 'select',
      name: 'code',
      message: 'Select menu',
      choices: [
        {
          title: 'Print current status',
          value: AppMenu.PRINT_STATUS,
        },
        {
          title: 'Layer 1 details',
          value: AppMenu.LAYER1_DETAIL,
        },
        {
          title: 'Coordinator info',
          value: AppMenu.COORDINATOR_INFO,
        },
        {
          title: 'Auction info',
          value: AppMenu.AUCTION_INFO,
        },
        {
          title: 'Start auto coordination',
          value: AppMenu.AUTO_COORDINATE,
        },
        {
          title: 'Stop auto coordination',
          value: AppMenu.STOP_AUTO_COORDINATION,
        },
        {
          title: 'Setup menu',
          value: AppMenu.SETUP_MENU,
        },
        {
          title: 'Exit',
          value: AppMenu.EXIT,
        },
      ],
    })
    switch (code) {
      default:
        return { context, next: code }
    }
  }
}
