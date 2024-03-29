import chalk from 'chalk'
import { Fp } from '@zkopru/babyjubjub'
import { RawTx } from '@zkopru/transaction'
import { logger } from '@zkopru/utils'
import assert from 'assert'
import { parseEther } from 'ethers/lib/utils'
import App, { AppMenu, Context } from '..'

export default class AtomicSwapTakeEth extends App {
  static code = AppMenu.ATOMIC_SWAP_TAKE_ETH

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<{ context: Context; next: number }> {
    const wallet = this.base
    const { account } = context
    if (!account) throw Error('Account is not set')
    const messages: string[] = []
    this.print(messages.join('\n'))

    let formatedAmount
    do {
      const { amount } = await this.ask({
        type: 'text',
        name: 'amount',
        initial: 0,
        message: 'How much ETH do you take(ex: 0.3 ETH)?',
      })

      formatedAmount = parseFloat(amount)
      if (!isNaN(formatedAmount)) {
        break
      }
      this.print(chalk.red('integer or float number only'))
    } while (true)
    const { salt } = await this.ask({
      type: 'text',
      name: 'salt',
      message: `Salt of the UTXO that you'll receive`,
    })

    const { swapTxBuilder } = context
    assert(swapTxBuilder, 'swap tx builder is not configured')
    const amountWei = parseEther(formatedAmount.toString())
    swapTxBuilder.receiveEther(Fp.from(amountWei), salt)
    let tx!: RawTx
    try {
      tx = swapTxBuilder.build()
      this.print(`Succeeded to build a transaction. Start to generate proof`)
    } catch (err) {
      if (err instanceof Error)
        this.print(`Failed to build transaction \n${err.toString()}`)
      console.log(err)
    }
    try {
      await wallet.sendTx({ tx, from: account })
    } catch (err) {
      if (err instanceof Error) logger.error(err)
      logger.error(tx)
    }
    return { context, next: AppMenu.ACCOUNT_DETAIL }
  }
}
