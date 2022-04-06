import chalk from 'chalk'
import { BurnAuction__factory } from '@zkopru/contracts'
import App, { AppMenu, Context } from '..'

export default class UpdateUrl extends App {
  static code = AppMenu.AUCTION_UPDATE_URL

  async run(context: Context): Promise<{ context: Context; next: number }> {
    const consensus = await this.base.layer1().zkopru.consensusProvider()
    const auction = BurnAuction__factory.connect(
      consensus,
      this.base.layer1().provider,
    )
    const myUrl = await auction.coordinatorUrls(
      await this.base.context.account.getAddress(),
    )
    this.print(chalk.blue(`Current url: ${myUrl}`))
    const { url } = await this.ask({
      type: 'text',
      name: 'url',
      initial: '',
      message:
        'Enter your URLs formatted as "host:port". Multiple values can be comma separated.',
    })
    const { confirmed } = await this.ask({
      type: 'confirm',
      name: 'confirmed',
      initial: true,
      message: chalk.blue(`Confirm new URL: ${url}`),
    })
    if (!confirmed) {
      return { context, next: AppMenu.AUCTION_MENU }
    }
    // send tx
    const tx = await auction.connect(this.base.context.account).setUrl(url)
    this.print(chalk.blue(`Waiting for block confirmation`))
    try {
      await tx.wait()
      this.print(chalk.blue('Done!'))
    } catch (err) {
      this.print(chalk.red('Error updating url!'))
    }
    return { context, next: AppMenu.TOP_MENU }
  }
}
