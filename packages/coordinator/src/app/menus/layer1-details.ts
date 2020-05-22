/* eslint-disable prettier/prettier */
import chalk from 'chalk'
import App, { AppMenu, Context } from '../app'

const { goTo, print } = App

export default class Layer1Details extends App {
  static code = AppMenu.LAYER1_DETAIL

  async run(context: Context): Promise<Context> {
    const { l1Contract } = this.coordinator.node
    const l1Config = await l1Contract.getConfig()
    print(chalk.blueBright)('Layer 1 configuration')
    print(chalk.blue)(`   genesis block                     : ${l1Config.genesisBlock}`)
    print(chalk.blue)(`   utxo tree depth                   : ${l1Config.utxoTreeDepth}`)
    print(chalk.blue)(`   withdraw tree depth               : ${l1Config.withdrawalTreeDepth}`)
    print(chalk.blue)(`   nullifier tree depth              : ${l1Config.nullifierTreeDepth}`)
    print(chalk.blue)(`   challenge period                  : ${l1Config.challengePeriod}`)
    print(chalk.blue)(`   minimum stake                     : ${l1Config.minimumStake} wei`)
    print(chalk.blue)(`   reference depth                   : ${l1Config.referenceDepth}`,)
    print(chalk.blue)(`   max utxos per tree                : ${l1Config.maxUtxoPerTree}`)
    print(chalk.blue)(`   max withdrawals per tree          : ${l1Config.maxWithdrawalPerTree}`)
    print(chalk.blue)(`   utxo rollup sub tree depth        : ${l1Config.utxoSubTreeDepth}`)
    print(chalk.blue)(`   utxo rollup sub tree size         : ${l1Config.utxoSubTreeSize}`)
    print(chalk.blue)(`   withdrawal rollup sub tree depth  : ${l1Config.withdrawalSubTreeDepth}`)
    print(chalk.blue)(`   withdrawal rollup sub tree size   : ${l1Config.withdrawalSubTreeSize}`)
    return {
      ...goTo(context, AppMenu.TOP_MENU),
    }
  }
}
