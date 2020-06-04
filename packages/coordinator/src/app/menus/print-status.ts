import chalk from 'chalk'
import App, { AppMenu, Context } from '../app'

const { goTo, print } = App

export default class PrintStatus extends App {
  static code = AppMenu.PRINT_STATUS

  async run(context: Context): Promise<Context> {
    const { l1Contract } = this.coordinator.node
    const { l2Chain } = this.coordinator.node
    const { txPool } = this.coordinator
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any = {}
    await Promise.all(
      [
        async () => {
          const latest = await l1Contract.upstream.methods.latest().call()
          result = { ...result, latest }
        },
        async () => {
          const {
            merged,
            fee,
          } = await l1Contract.upstream.methods.stagedDeposits().call()
          result = { ...result, merged, fee }
        },
      ].map(f => f()),
    )
    print(chalk.blueBright)('Layer1 status')
    print(chalk.blue)(`  Latest block: ${result.latest}`)
    print(chalk.blue)(`  Deposits: ${result.merged} / Fee: ${result.fee} wei`)
    print(chalk.blue)(``)
    print(chalk.blueBright)('Layer2 status')
    print(chalk.blue)(`  Latest block: ${await l2Chain.getLatestBlockHash()}`)
    print(chalk.blue)(`  Pending txs: ${txPool.pendingNum()}`)
    print(chalk.blue)(``)
    return {
      ...goTo(context, AppMenu.TOP_MENU),
    }
  }
}
