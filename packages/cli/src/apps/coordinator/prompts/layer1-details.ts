/* eslint-disable prettier/prettier */
import chalk from 'chalk'
import App, { AppMenu, Context } from '.'

export default class Layer1Details extends App {
  static code = AppMenu.LAYER1_DETAIL

  async run(context: Context): Promise<{ context: Context; next: number }> {
    const { l1Contract } = this.base.node
    const l1Config = await l1Contract.getConfig()
    this.print(chalk.blueBright(`Layer 1 configuration
    utxo tree depth                   : ${l1Config.utxoTreeDepth}
    withdraw tree depth               : ${l1Config.withdrawalTreeDepth}
    nullifier tree depth              : ${l1Config.nullifierTreeDepth}
    challenge period                  : ${l1Config.challengePeriod}
    minimum stake                     : ${l1Config.minimumStake} wei
    reference depth                   : ${l1Config.referenceDepth}
    max utxos per tree                : ${l1Config.maxUtxo}
    max withdrawals per tree          : ${l1Config.maxWithdrawal}
    utxo rollup sub tree depth        : ${l1Config.utxoSubTreeDepth}
    utxo rollup sub tree size         : ${l1Config.utxoSubTreeSize}
    withdrawal rollup sub tree depth  : ${l1Config.withdrawalSubTreeDepth}
    withdrawal rollup sub tree size   : ${l1Config.withdrawalSubTreeSize}`))
    return { context, next: AppMenu.TOP_MENU }
  }
}
