import chalk from 'chalk'
import { BurnAuction__factory } from '@zkopru/contracts'
import { formatEther } from 'ethers/lib/utils'
import App, { AppMenu, Context } from '..'

export default class Refund extends App {
  static code = AppMenu.AUCTION_REFUND

  async run(context: Context): Promise<{ context: Context; next: number }> {
    const consensus = await this.base.layer1().zkopru.consensusProvider()
    const auction = BurnAuction__factory.connect(
      consensus,
      this.base.layer1().provider,
    )
    const pendingBalance = await auction.pendingBalances(
      await this.base.context.account.getAddress(),
    )
    if (pendingBalance.toString() === '0') {
      // nothing to refund
      this.print(chalk.red(`No balance to refund!`))
      return { context, next: AppMenu.TOP_MENU }
    }
    const { confirmed } = await this.ask({
      type: 'confirm',
      name: 'confirmed',
      initial: true,
      message: chalk.blue(`Refund ${formatEther(pendingBalance)} Ether?`),
    })
    if (!confirmed) {
      return { context, next: AppMenu.AUCTION_MENU }
    }
    const tx = await auction.connect(this.base.context.account)['refund()']()
    this.print(chalk.blue(`Refunding, waiting for block confirmation...`))
    try {
      await tx.wait()
      this.print(chalk.blue('Done!'))
    } catch (err) {
      this.print(chalk.red('Error refunding!'))
    }
    return { context, next: AppMenu.TOP_MENU }
  }
}
