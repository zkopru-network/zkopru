/* eslint-disable prettier/prettier */
import { Layer1 } from '@zkopru/contracts'
import App, { AppMenu, Context } from '.'

export default class CoordinatorInfo extends App {
  static code = AppMenu.AUCTION_INFO

  async run(context: Context): Promise<{ context: Context; next: number }> {
    const consensus = await this.base.layer1().upstream.methods.consensusProvider().call()
    const auction = Layer1.getIBurnAuction(this.base.layer1().web3, consensus)
    const [ currentRound, blockNumber ] = await Promise.all([
      auction.methods.currentRound().call(),
      this.base.layer1().web3.eth.getBlockNumber(),
    ])
    const [ currentProposer, nextProposer, nextRoundStart ] = await Promise.all([
      auction.methods.coordinatorForRound(currentRound).call(),
      auction.methods.coordinatorForRound(+currentRound + 1).call(),
      auction.methods.calcRoundStart(+currentRound + 1).call(),
    ])
    // const [ currentProposerUrl, nextProposerUrl ] = await Promise.all([
    //   auction.methods.coordinatorUrls(currentProposer).call(),
    //   auction.methods.coordinatorUrls(nextProposer).call(),
    // ])

    this.print(`Auction information
    Current round       : ${currentRound}
    Current proposer    : ${currentProposer}
    Remaining blocks    : ${+nextRoundStart - blockNumber}
    Next proposer       : ${nextProposer}`)
    return { context, next: AppMenu.TOP_MENU }
  }
}
