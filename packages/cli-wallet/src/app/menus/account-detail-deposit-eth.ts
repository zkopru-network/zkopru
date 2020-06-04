import { toBN, fromWei, toWei } from 'web3-utils'
import assert from 'assert'
import chalk from 'chalk'
import App, { AppMenu, Context } from '../app'

const { print, goTo } = App

export default class DepositEther extends App {
  static code = AppMenu.DEPOSIT_ETHER

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<Context> {
    if (!context.account) throw Error('Acocunt is not set')
    const { balance } = context
    // const weiPerByte = await this.zkWallet.fetchPrice()
    assert(balance, 'Balance is defined')
    // print(chalk.blue)(`Price per byte: ${fromWei(weiPerByte, 'gwei')} gwei`)
    const { amount } = await this.ask({
      type: 'text',
      name: 'amount',
      initial: 0,
      message: 'How much ETH do you want to deposit?',
    })
    const { fee } = await this.ask({
      type: 'text',
      name: 'fee',
      initial: 0,
      message: 'How much ETH do you want pay for the fee?',
    })
    const amountWei: string = toWei(amount).toString()
    const feeWei: string = toWei(fee).toString()
    const total = toBN(amountWei).add(toBN(feeWei))
    if (toBN(balance.eth).lt(total)) {
      print(chalk.red)('Not enough balance. Try again')
    }
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
      return { ...goTo(context, AppMenu.DEPOSIT) }
    }
    const success = await this.zkWallet.depositEther(amountWei, feeWei)
    if (!success) {
      const { tryAgain } = await this.ask({
        type: 'confirm',
        name: 'tryAgain',
        initial: true,
        message: 'Failed to deposit your balance. Do you want to try again?',
      })
      if (!tryAgain) {
        return { ...goTo(context, AppMenu.DEPOSIT_ETHER) }
      }
    } else {
      print(chalk.green)(
        'Successfully deposited. You need to wait the coordinator include your deposit into a block.',
      )
    }
    return { ...goTo(context, AppMenu.DEPOSIT) }
  }
}
