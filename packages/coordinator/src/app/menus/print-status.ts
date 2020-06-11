import chalk from 'chalk'
import App, { AppMenu, Context } from '../app'

export default class PrintStatus extends App {
  static code = AppMenu.PRINT_STATUS

  async run(context: Context): Promise<{ context: Context; next: number }> {
    const { l1Contract } = this.base.node
    const { txPool } = this.base
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
    this.print(
      `${chalk.blueBright('Layer1 status')}${chalk.blue(`
    Latest block: ${result.latest}
    Deposits: ${result.merged} / Fee: ${result.fee} wei`)}${chalk.blueBright(
        'Layer2 status',
      )}${chalk.blue(`
    Latest block: ${await this.base.node.latestBlock()}
    Pending txs: ${txPool.pendingNum()}`)}`,
    )
    return {
      context,
      next: AppMenu.TOP_MENU,
    }
  }
}
