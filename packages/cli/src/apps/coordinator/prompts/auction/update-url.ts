import chalk from 'chalk'
import App, { AppMenu, Context } from '..'
import { Layer1 } from '@zkopru/contracts'

export default class UpdateUrl extends App {
  static code = AppMenu.AUCTION_UPDATE_URL

  async run(context: Context): Promise<{ context: Context; next: number }> {
    const consensus = await this.base
      .layer1()
      .upstream.methods.consensusProvider()
      .call()
    const auction = Layer1.getIBurnAuction(this.base.layer1().web3, consensus)
    const myUrl = await auction.methods
      .coordinatorUrls(this.base.context.account.address)
      .call()
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
    const tx = this.base
      .layer1()
      .sendExternalTx(
        auction.methods.setUrl(url),
        this.base.context.account,
        consensus,
      )
    this.print(chalk.blue(`Waiting for block confirmation`))
    try {
      await tx
      this.print(chalk.blue('Done!'))
    } catch (err) {
      this.print(chalk.red('Error updating url!'))
    }
    return { context, next: AppMenu.TOP_MENU }
  }
}
