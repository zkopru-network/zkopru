import { Fp } from '@zkopru/babyjubjub'
import { Sum, TxBuilder, RawTx, Utxo, ZkAddress } from '@zkopru/transaction'
import { logger } from '@zkopru/utils'
import { Address } from 'soltypes'
import { formatUnits, isAddress, parseUnits } from 'ethers/lib/utils'
import { BigNumber } from 'ethers'
import App, { AppMenu, Context } from '..'

export default class WithdrawRequestEth extends App {
  static code = AppMenu.WITHDRAW_REQUEST_ETH

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
    messages.push(
      `Withdrawable ETH: ${formatUnits(spendableAmount.eth, 'ether')}`,
    )
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
    let to!: Address
    do {
      const msgs: string[] = []
      const { address } = await this.ask({
        type: 'text',
        name: 'address',
        initial: '0xabcdef0123456789abcdef0123456789abcdef012',
        message: 'Withdraw out to? (Ethereum address)',
      })
      try {
        to = Address.from(address)
      } catch (err) {
        logger.error(`Failed to get address from`)
        if (err instanceof Error) logger.error(err)
      }
      if (!isAddress(to.toString())) {
        this.print('Provided invalid Ethereum address')
        // eslint-disable-next-line no-continue
        continue
      }
      const { amount } = await this.ask({
        type: 'text',
        name: 'amount',
        initial: 0,
        message: 'How much ETH do you want to transfer(ex: 0.3 ETH)?',
      })
      amountWei = parseUnits(amount, 'ether').toString()
      msgs.push(`Sending amount: ${formatUnits(amountWei, 'ether')} ETH`)
      msgs.push(`    = ${amountWei} wei`)
      this.print([...messages, ...msgs].join('\n'))
      const gweiPerByte = formatUnits(weiPerByte, 'gwei')
      const { fee } = await this.ask({
        type: 'text',
        name: 'fee',
        initial: `${gweiPerByte} gwei`,
        message: `Fee per byte. ex) ${gweiPerByte} gwei`,
      })
      confirmedWeiPerByte = parseUnits(fee, 'gwei')
      msgs.push(
        `Wei per byte: ${formatUnits(confirmedWeiPerByte, 'ether')} ETH`,
      )
      msgs.push(`    = ${formatUnits(confirmedWeiPerByte, 'gwei')} gwei`)
      this.print(messages.join('\n'))
      const { prePayFee } = await this.ask({
        type: 'text',
        name: 'prePayFee',
        initial: `0 gwei`,
        message: `Additional fee for instant withdrawal.`,
      })
      const confirmedPrePayFeeToWei = parseUnits(prePayFee, 'gwei')
      msgs.push(
        `Instant withdrawal fee: ${formatUnits(
          confirmedPrePayFeeToWei,
          'ether',
        )} ETH`,
      )
      msgs.push(`    = ${formatUnits(confirmedPrePayFeeToWei, 'gwei')} gwei`)
      this.print(messages.join('\n'))

      const txBuilder = TxBuilder.from(account.zkAddress)
      try {
        tx = txBuilder
          .provide(...spendables.map(note => Utxo.from(note)))
          .weiPerByte(confirmedWeiPerByte)
          .sendEther({
            eth: Fp.from(amountWei),
            to: ZkAddress.null,
            withdrawal: {
              to: Fp.from(to.toString()),
              fee: Fp.from(confirmedPrePayFeeToWei),
            },
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
