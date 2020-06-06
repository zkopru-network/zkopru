import { NetworkStatus } from '@zkopru/core'
import chalk from 'chalk'
import { ZkWallet } from '../zk-wallet'
import App, { AppMenu, Context } from './app'
import TopMenu from './menus/top-menus'
import OnSyncing from './menus/on-syncing'
import AccountDetail from './menus/account-detail'
import Deposit from './menus/account-detail-deposit'
import DepositEther from './menus/account-detail-deposit-eth'

const { print } = App

export async function runCliApp(
  zkWallet: ZkWallet,
  onError?: () => Promise<void>,
): Promise<void> {
  const defaultOnCancel = () => {
    process.exit()
  }
  const onCancel = onError || defaultOnCancel
  let context: Context = {
    menu: AppMenu.TOP_MENU,
    isReady: false,
  }
  const { node } = zkWallet
  let isReady = false
  node.on('status', (status: NetworkStatus) => {
    switch (status) {
      case NetworkStatus.ON_SYNCING:
        if (isReady) print(chalk.blue)('Synchronizing ZKOPRU network')
        isReady = false
        break
      case NetworkStatus.FULLY_SYNCED:
        if (isReady) print(chalk.blue)('Network is fully synced')
        isReady = true
        break
      case NetworkStatus.SYNCED:
        if (!isReady) print(chalk.green)('Synchronizing is fully synced')
        isReady = true
        break
      case NetworkStatus.ON_PROCESSING:
        if (!isReady) print(chalk.green)('On processing..')
        isReady = false
        break
      case NetworkStatus.ON_ERROR:
        if (isReady) print(chalk.red)('Error occured during synchronization')
        isReady = false
        break
      default:
        print(chalk.red)('Network sync stopped')
        isReady = false
        break
    }
  })
  node.startSync()
  const appFor = {}
  appFor[AppMenu.TOP_MENU] = new TopMenu(zkWallet, onCancel)
  appFor[AppMenu.ON_SYNCING] = new OnSyncing(zkWallet, onCancel)
  appFor[AppMenu.ACCOUNT_DETAIL] = new AccountDetail(zkWallet, onCancel)
  appFor[AppMenu.DEPOSIT] = new Deposit(zkWallet, onCancel)
  appFor[AppMenu.DEPOSIT_ETHER] = new DepositEther(zkWallet, onCancel)
  while (context.menu !== AppMenu.EXIT) {
    let menu: AppMenu
    if (context.isReady) menu = context.menu
    else menu = AppMenu.ON_SYNCING
    const app = appFor[menu]
    if (app) {
      context = await app.run(context)
      context.isReady = isReady
    } else {
      break
    }
  }
  process.exit()
}
