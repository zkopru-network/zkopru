import chalk from 'chalk'
import { Layer1 } from '@zkopru/contracts'
import { fromWei } from 'web3-utils'
import App, { AppMenu, Context } from '..'

export default class Refund extends App {
  static code = AppMenu.AUCTION_REFUND

  async run(context: Context): Promise<{ context: Context; next: number }> {
    const consensus = await this.base
      .layer1()
      .upstream.methods.consensusProvider()
      .call()
    const auction = Layer1.getIBurnAuction(this.base.layer1().web3, consensus)
    const pendingBalance = await auction.methods
      .pendingBalances(this.base.context.account.address)
      .call()
    if (pendingBalance.toString() === '0') {
      // nothing to refund
      this.print(chalk.red(`No balance to refund!`))
      return { context, next: AppMenu.TOP_MENU }
    }
    const { confirmed } = await this.ask({
      type: 'confirm',
      name: 'confirmed',
      initial: true,
      message: chalk.blue(
        `Refund ${fromWei(pendingBalance).toString()} Ether?`,
      ),
    })
    if (!confirmed) {
      return { context, next: AppMenu.AUCTION_MENU }
    }
    const tx = this.base
      .layer1()
      .sendExternalTx(
        auction.methods.refund(),
        this.base.context.account,
        consensus,
      )
    this.print(chalk.blue(`Refunding, waiting for block confirmation...`))
    try {
      await tx
      this.print(chalk.blue('Done!'))
    } catch (err) {
      this.print(chalk.red('Error refunding!'))
    }
    return { context, next: AppMenu.TOP_MENU }
  }
}
