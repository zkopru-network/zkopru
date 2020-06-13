import { toBN, fromWei, toWei } from 'web3-utils'
import assert from 'assert'
import chalk from 'chalk'
import { parseStringToUnit, logger } from '@zkopru/utils'
import App, { AppMenu, Context } from '..'

export default class DepositEther extends App {
  static code = AppMenu.DEPOSIT_ETHER

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<{ context: Context; next: number }> {
    if (!context.account) throw Error('Acocunt is not set')
    const { balance } = context
    assert(balance, 'Balance is defined')
    // print(chalk.blue)(`Price per byte: ${fromWei(weiPerByte, 'gwei')} gwei`)
    let amountWei: string
    let feeWei: string
    let hasEnoughBalance = false
    do {
      const { amount } = await this.ask({
        type: 'text',
        name: 'amount',
        initial: 0,
        message: 'How much ETH do you want to deposit?',
      })
      const parsedEth = parseStringToUnit(amount, 'ether')
      amountWei = toWei(parsedEth.val, parsedEth.unit).toString()
      const messages: string[] = []
      messages.push(`Amount: ${amount} ETH`)
      messages.push(`    = ${amountWei} wei`)
      this.print(messages.join('\n'))
      const { fee } = await this.ask({
        type: 'text',
        name: 'fee',
        initial: 0,
        message: 'How much ETH do you want to pay for the fee?',
      })
      const parsedFee = parseStringToUnit(amount, 'ether')
      feeWei = toWei(parsedFee.val, parsedFee.unit).toString()
      messages.push(`Fee: ${fee} ETH`)
      messages.push(`    = ${feeWei} wei`)
      this.print(messages.join('\n'))
      const total = toBN(amountWei).add(toBN(feeWei))
      if (toBN(balance.eth).lt(total)) {
        this.print(chalk.red('Not enough balance. Try again'))
      } else {
        hasEnoughBalance = true
      }
    } while (!hasEnoughBalance)

    const { confirmed } = await this.ask({
      type: 'confirm',
      name: 'confirmed',
      initial: true,
      message: chalk.blue(
        `Deposit: ${fromWei(amountWei, 'ether')} ETH / Fee: ${fromWei(
          feeWei,
          'ether',
        )} ETH`,
      ),
    })
    if (!confirmed) {
      return { context, next: AppMenu.DEPOSIT }
    }
    let success = false
    try {
      success = await this.base.depositEther(amountWei, feeWei)
    } catch (err) {
      logger.error(err)
    }
    if (!success) {
      const { tryAgain } = await this.ask({
        type: 'confirm',
        name: 'tryAgain',
        initial: true,
        message: 'Failed to deposit your balance. Do you want to try again?',
      })
      if (!tryAgain) {
        return { context, next: AppMenu.DEPOSIT_ETHER }
      }
    } else {
      this.print(
        chalk.green(
          'Successfully deposited. You need to wait the coordinator include your deposit into a block.',
        ),
      )
    }
    return { context, next: AppMenu.DEPOSIT }
  }
}
