import App, { AppMenu, Context } from '..'

export default class Withdraw extends App {
  static code = AppMenu.WITHDRAW

  // eslint-disable-next-line class-methods-use-this
  async run(context: Context): Promise<{ context: Context; next: number }> {
    if (!context.account) throw Error('Account is not set')
    if (!context.withdrawal) throw Error('Withdrawal is not set')
    const result = await this.base.withdraw(context.withdrawal)
    this.print(`Result: ${result ? 'OK' : 'Failed'}`)
    return {
      next: AppMenu.WITHDRAWABLE_LIST,
      context: { ...context, withdrawal: undefined },
    }
  }
}
