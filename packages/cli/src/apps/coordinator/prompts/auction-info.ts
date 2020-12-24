/* eslint-disable prettier/prettier */
import App, { AppMenu, Context } from '.'
import { Layer1 } from '@zkopru/contracts'

export default class CoordinatorInfo extends App {
  static code = AppMenu.AUCTION_INFO

  async run(context: Context): Promise<{ context: Context; next: number }> {
    const consensus = await this.base
      .layer1()
      .upstream.methods.consensusProvider()
      .call()
    const auction = Layer1.getIBurnAuction(this.base.layer1().web3, consensus)
    const [currentRound, blockNumber] = await Promise.all([
      auction.methods.currentRound().call(),
      this.base.layer1().web3.eth.getBlockNumber(),
    ])
    const [
      currentProposer,
      nextProposer,
      nextRoundStart,
      pendingBalance,
      myUrl,
    ] = await Promise.all([
      auction.methods.coordinatorForRound(currentRound).call(),
      auction.methods.coordinatorForRound(+currentRound + 1).call(),
      auction.methods.calcRoundStart(+currentRound + 1).call(),
      auction.methods.pendingBalances(this.base.context.account.address).call(),
      auction.methods.coordinatorUrls(this.base.context.account.address).call(),
    ])

    this.print(`Auction information
    Current round       : ${currentRound}
    Current proposer    : ${currentProposer}
    Remaining blocks    : ${+nextRoundStart - blockNumber}
    Next proposer       : ${nextProposer}
    My urls             : ${myUrl}
    Available balance   : ${this.base
      .layer1()
      .web3.utils.fromWei(pendingBalance)}`)
    return { context, next: AppMenu.TOP_MENU }
  }
}
