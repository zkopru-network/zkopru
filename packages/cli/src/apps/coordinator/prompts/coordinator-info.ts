/* eslint-disable prettier/prettier */
import App, { AppMenu, Context } from '.'

export default class CoordinatorInfo extends App {
  static code = AppMenu.COORDINATOR_INFO

  async run(context: Context): Promise<{ context: Context; next: number }> {
    const {
      stake,
      reward,
      exitAllowance,
    } = await this.base
      .layer1()
      .zkopru.proposers(await this.base.context.account.getAddress())
    this.print(`Coordinator information
    Staked amount       : ${stake}
    Accumulated rewards : ${reward}
    Exit allowance      : ${exitAllowance}`)
    return { context, next: AppMenu.TOP_MENU }
  }
}
