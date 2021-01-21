import chalk from 'chalk'
import App, { AppMenu, Context } from '.'

export default class PrintStatus extends App {
  static code = AppMenu.PRINT_STATUS

  async run(context: Context): Promise<{ context: Context; next: number }> {
    const { node, txPool } = this.base.context
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any = {}
    await Promise.all(
      [
        async () => {
          const latest = await this.base
            .layer1()
            .upstream.methods.latest()
            .call()
          result = { ...result, latest }
        },
        async () => {
          const { merged, fee } = await this.base
            .layer1()
            .upstream.methods.stagedDeposits()
            .call()
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
    Latest block: ${(await node.layer2.latestBlock())?.toString()}
    Pending txs: ${txPool.pendingNum()}`)}`,
    )
    return {
      context,
      next: AppMenu.TOP_MENU,
    }
  }
}
