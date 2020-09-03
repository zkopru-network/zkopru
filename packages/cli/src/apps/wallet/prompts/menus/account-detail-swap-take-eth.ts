import { RawTx } from '@zkopru/transaction'
import { logger } from '@zkopru/utils'
import assert from 'assert'
import App, { AppMenu, Context } from '..'

export default class AtomicSwapTakeEth extends App {
  static code = AppMenu.ATOMIC_SWAP_TAKE_ETH

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<{ context: Context; next: number }> {
    const wallet = this.base
    const { account } = context
    if (!account) throw Error('Acocunt is not set')
    const messages: string[] = []
    this.print(messages.join('\n'))

    const { amount } = await this.ask({
      type: 'text',
      name: 'amount',
      initial: 0,
      message: 'How much ETH do you take(ex: 0.3 ETH)?',
    })
    const { salt } = await this.ask({
      type: 'text',
      name: 'salt',
      message: `Salt of the UTXO that you'll receive`,
    })

    const { swapTxBuilder } = context
    assert(swapTxBuilder, 'swap tx builder is not configured')
    swapTxBuilder.receiveEther(amount, salt)
    let tx!: RawTx
    try {
      tx = swapTxBuilder.build()
      this.print(`Succeeded to build a transaction. Start to generate proof`)
    } catch (err) {
      this.print(`Failed to build transaction \n${err.toString()}`)
    }
    try {
      await wallet.sendTx({ tx, from: account })
    } catch (err) {
      logger.error(err)
      logger.error(tx)
    }
    return { context, next: AppMenu.ACCOUNT_DETAIL }
  }
}
