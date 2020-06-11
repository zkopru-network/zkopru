/* eslint-disable prettier/prettier */
import App, { AppMenu, Context } from '../app'

export default class CoordinatorInfo extends App {
  static code = AppMenu.COORDINATOR_INFO

  async run(context: Context): Promise<{ context: Context; next: number }> {
    const { l1Contract } = this.base.node
    const { stake, reward, exitAllowance } = await l1Contract.upstream.methods.proposers(this.base.account.address).call()
    this.print(`Coordinator information
    Staked amount       : ${stake}
    Accumulated rewards : ${reward}
    Exit allowance      : ${exitAllowance}`)
    return { context, next: AppMenu.TOP_MENU }
  }
}
