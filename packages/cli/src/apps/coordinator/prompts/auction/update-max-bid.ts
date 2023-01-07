import chalk from 'chalk'
import { parseStringToUnit } from '@zkopru/utils'
import { formatUnits, parseUnits } from 'ethers/lib/utils'
import App, { AppMenu, Context } from '..'

export default class UpdateMaxBid extends App {
  static code = AppMenu.AUCTION_UPDATE_MAX_BID

  async run(context: Context): Promise<{ context: Context; next: number }> {
    const { maxBid } = this.base.context.auctionMonitor
    const parsedGwei = formatUnits(maxBid, 'gwei')
    this.print(chalk.blue(`Current max bid: ${parsedGwei.toString()} gwei`))
    const { amount } = await this.ask({
      type: 'text',
      name: 'amount',
      initial: 0,
      message: 'New max bid price (gwei):',
    })
    if (amount.trim()) {
      const parsed = parseStringToUnit(amount, 'gwei')
      const amountWei = parseUnits(parsed.val, parsed.unit).toString()
      this.print(chalk.blue(`Updating max bid...`))
      await this.base.context.auctionMonitor.setMaxBid(amountWei)
      this.print(
        chalk.blue(
          `New max bid: ${formatUnits(amountWei, 'gwei').toString()} gwei`,
        ),
      )
    }
    return { context, next: AppMenu.TOP_MENU }
  }
}
