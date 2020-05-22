/* eslint-disable prettier/prettier */
import chalk from 'chalk'
import App, { AppMenu, Context } from '../app'

const { goTo, print } = App

export default class CoordinatorInfo extends App {
  static code = AppMenu.COORDINATOR_INFO

  async run(context: Context): Promise<Context> {
    const { l1Contract } = this.coordinator.node
    const { stake, reward, exitAllowance } = await l1Contract.upstream.methods.proposers(this.coordinator.account.address).call()
    print(chalk.blueBright)('Coordinator information')
    print(chalk.blue)(`   Staked amount       : ${stake}`)
    print(chalk.blue)(`   Accumulated rewards : ${reward}`)
    print(chalk.blue)(`   Exit allowance      : ${exitAllowance}`)
    return {
      ...goTo(context, AppMenu.TOP_MENU),
    }
  }
}
