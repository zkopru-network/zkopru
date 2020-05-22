#!/usr/bin/env node

/* eslint-disable no-case-declarations */
import { NetworkStatus } from '@zkopru/core'
import { Menu, Context, Config } from './configurator'
import Splash from './menus/splash'
import ConnectWeb3 from './menus/connect-web3'
import DownloadKeys from './menus/download-keys'
import LoadDatabase from './menus/load-database'
import LoadHDWallet from './menus/load-hdwallet'
import LoadNode from './menus/load-node'
import TrackingAccount from './menus/config-tracking-accounts'
import NodeSync from './menus/node-sync'
import SaveConfig from './menus/save-config'
import { ZkWallet } from '../zk-wallet'

const defaultOnCancel = () => {
  process.exit()
}

export async function getZkWallet(
  config: Config,
  onError?: () => Promise<void>,
): Promise<ZkWallet> {
  const onCancel = onError || defaultOnCancel
  let context: Context = {
    menu: Menu.SPLASH,
    networkStatus: NetworkStatus.STOPPED,
  }
  const menus = {}
  menus[Menu.SPLASH] = new Splash(config, onCancel)
  menus[Menu.CONNECT_WEB3] = new ConnectWeb3(config, onCancel)
  menus[Menu.DOWNLOAD_KEYS] = new DownloadKeys(config, onCancel)
  menus[Menu.LOAD_DATABASE] = new LoadDatabase(config, onCancel)
  menus[Menu.LOAD_HDWALLET] = new LoadHDWallet(config, onCancel)
  menus[Menu.CONFIG_TRACKING_ACCOUNT] = new TrackingAccount(config, onCancel)
  menus[Menu.LOAD_NODE] = new LoadNode(config, onCancel)
  menus[Menu.NODE_SYNC] = new NodeSync(config, onCancel)
  menus[Menu.SAVE_CONFIG] = new SaveConfig(config, onCancel)
  while (context.menu !== Menu.EXIT) {
    const menu = menus[context.menu]
    if (menu) {
      context = await menu.run(context)
    } else {
      break
    }
  }
  if (!context.zkWallet) throw Error('Wallet is not configured')
  return context.zkWallet
}
