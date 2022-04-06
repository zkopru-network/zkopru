/* eslint-disable prettier/prettier */
import { BurnAuction__factory } from '@zkopru/contracts'
import { formatEther } from 'ethers/lib/utils'
import App, { AppMenu, Context } from '.'

export default class CoordinatorInfo extends App {
  static code = AppMenu.AUCTION_INFO

  async run(context: Context): Promise<{ context: Context; next: number }> {
    const consensus = await this.base.layer1().zkopru.consensusProvider()
    const auction = BurnAuction__factory.connect(
      consensus,
      this.base.layer1().provider,
    )
    const [currentRound, blockNumber] = await Promise.all([
      auction.currentRound(),
      this.base.layer1().provider.getBlockNumber(),
    ])
    const [
      currentProposer,
      nextProposer,
      nextRoundStart,
      pendingBalance,
      myUrl,
    ] = await Promise.all([
      auction.coordinatorForRound(currentRound),
      auction.coordinatorForRound(+currentRound + 1),
      auction.calcRoundStart(+currentRound + 1),
      auction.pendingBalances(await this.base.context.account.getAddress()),
      auction.coordinatorUrls(await this.base.context.account.getAddress()),
    ])

    this.print(`Auction information
    Current round       : ${currentRound}
    Current proposer    : ${currentProposer}
    Remaining blocks    : ${+nextRoundStart - blockNumber}
    Next proposer       : ${nextProposer}
    My urls             : ${myUrl}
    Available balance   : ${formatEther(pendingBalance)}`)
    return { context, next: AppMenu.TOP_MENU }
  }
}
