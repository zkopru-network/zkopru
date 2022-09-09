import { Fp } from '@zkopru/babyjubjub'
import { Sum, TxBuilder, RawTx, Utxo, ZkAddress } from '@zkopru/transaction'
import { logger } from '@zkopru/utils'
import { BigNumber } from 'ethers'
import {
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
} from 'ethers/lib/utils'
import App, { AppMenu, Context } from '..'

export default class TransferEth extends App {
  static code = AppMenu.TRANSFER_ETH

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<{ context: Context; next: number }> {
    const wallet = this.base
    const { account } = context
    if (!account) throw Error('Account is not set')
    const spendables: Utxo[] = await wallet.getSpendables(account)
    const spendableAmount = Sum.from(spendables)
    let weiPerByte!: string
    try {
      weiPerByte = await wallet.fetchPrice()
    } catch (err) {
      logger.error('price fetch error')
      if (err instanceof Error) logger.error(err.toString())
      throw err
    }
    const regularPrice = formatUnits(
      BigNumber.from(weiPerByte || '0')
        .mul(566) // 566 : for 2 inputs & 2 outputs
        .toString(),
      'ether',
    )
    const messages: string[] = []
    messages.push(`Account: ${account.zkAddress.toString()}`)
    messages.push(`Spendable ETH: ${formatUnits(spendableAmount.eth, 'ether')}`)
    messages.push(
      `Recommended fee per byte: ${formatUnits(
        weiPerByte,
        'gwei',
      )} gwei / byte`,
    )
    messages.push(
      `You may spend ${regularPrice} ETH to send a 566 bytes size tx.`,
    )
    this.print(messages.join('\n'))
    let amountWei: string
    let confirmedWeiPerByte: BigNumber
    let tx!: RawTx
    let to!: ZkAddress
    do {
      const msgs: string[] = []
      const { zkAddress } = await this.ask({
        type: 'text',
        name: 'zkAddress',
        initial: 'bbyozxbgoaisdfnjcx7zisdfasdfuhaisdf81..',
        message: 'Send to? (Zkopru address)',
      })
      try {
        to = new ZkAddress(zkAddress)
      } catch (err) {
        logger.error(`Failed to get a point from ${zkAddress}`)
        if (err instanceof Error) logger.error(err)
      }
      const { amount } = await this.ask({
        type: 'text',
        name: 'amount',
        initial: 0,
        message: 'How much ETH do you want to transfer(ex: 0.3 ETH)?',
      })
      amountWei = parseEther(amount.toString()).toString()
      msgs.push(`Sending amount: ${formatEther(amountWei)} ETH`)
      msgs.push(`    = ${amountWei} wei`)
      this.print([...messages, ...msgs].join('\n'))
      const gweiPerByte = formatUnits(weiPerByte, 'gwei')
      const { fee } = await this.ask({
        type: 'text',
        name: 'fee',
        initial: `${gweiPerByte} gwei`,
        message: `Fee per byte. ex) ${gweiPerByte} gwei`,
      })
      confirmedWeiPerByte = parseUnits(fee.toString(), 'gwei')
      logger.info(`confirmedWeiPerByte: ${confirmedWeiPerByte}`)
      msgs.push(
        `Wei per byte: ${formatUnits(confirmedWeiPerByte, 'ether')} ETH`,
      )
      msgs.push(`    = ${formatUnits(confirmedWeiPerByte, 'gwei')} gwei`)
      this.print(messages.join('\n'))

      const txBuilder = TxBuilder.from(account.zkAddress)
      try {
        tx = txBuilder
          .provide(...spendables.map(note => Utxo.from(note)))
          .weiPerByte(confirmedWeiPerByte)
          .sendEther({
            eth: Fp.from(amountWei),
            to,
          })
          .build()
        this.print(`Succeeded to build a transaction. Start to generate proof`)
      } catch (err) {
        if (err instanceof Error)
          this.print(`Failed to build transaction \n${err.toString()}`)
      }
    } while (!tx)

    try {
      await wallet.sendTx({ tx, from: account })
    } catch (err) {
      if (err instanceof Error) logger.error(err)
      logger.error(tx)
    }
    return { context, next: AppMenu.TRANSFER }
  }
}
