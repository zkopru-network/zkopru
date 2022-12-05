#!/usr/bin/env node

/* eslint-disable no-case-declarations */
import { NetworkStatus } from '@zkopru/core'
import { PromptApp } from '@zkopru/utils'
import { ZkWallet } from '@zkopru/zk-wizard'
import { Writable } from 'stream'
import assert from 'assert'
import { Address } from 'soltypes'
import { Menu, Context, Config } from './configurator'
import Splash from './menus/splash'
import ConnectWeb3 from './menus/connect-web3'
import DownloadKeys from './menus/download-keys'
import LoadDatabase from './menus/load-database'
import LoadHDWallet from './menus/load-hdwallet'
import LoadNode from './menus/load-node'
import TrackingAccount from './menus/config-tracking-accounts'
import SaveConfig from './menus/save-config'

const defaultOnCancel = () => {
  process.exit()
}

export async function getZkWallet(
  config: Config,
  onError?: () => Promise<void>,
): Promise<ZkWallet | undefined> {
  const onCancel = onError || defaultOnCancel
  let context: Context = {
    menu: Menu.SPLASH,
    networkStatus: NetworkStatus.STOPPED,
  }
  const apps: { [key: number]: PromptApp<Context, Config> } = {}
  const option = {
    base: config,
    onCancel,
    infoStream: new Writable({
      write: (_chunk, _enc, cb) => {
        cb()
      },
    }),
  }
  apps[Menu.SPLASH] = new Splash(option)
  apps[Menu.CONNECT_WEB3] = new ConnectWeb3(option)
  apps[Menu.DOWNLOAD_KEYS] = new DownloadKeys(option)
  apps[Menu.LOAD_DATABASE] = new LoadDatabase(option)
  apps[Menu.LOAD_HDWALLET] = new LoadHDWallet(option)
  apps[Menu.CONFIG_TRACKING_ACCOUNT] = new TrackingAccount(option)
  apps[Menu.LOAD_NODE] = new LoadNode(option)
  apps[Menu.SAVE_CONFIG] = new SaveConfig(option)
  let next = Menu.SPLASH
  while (next !== Menu.COMPLETE) {
    const app = apps[next]
    if (app) {
      const result = await app.run(context)
      next = result.next
      context = result.context
    } else {
      break
    }
  }
  if (context.menu === Menu.EXIT) return undefined
  const { db, wallet, node, accounts } = context
  const { erc20, erc721, snarkKeyPath, snarkKeyCid } = config
  assert(db, 'db')
  assert(wallet, 'wallet')
  assert(accounts, 'accounts')
  assert(node, 'node')
  const zkWallet = new ZkWallet({
    db,
    wallet,
    node,
    accounts,
    l1Address: accounts[0].ethAddress,
    erc20: erc20?.map(Address.from) || [],
    erc721: erc721?.map(Address.from) || [],
    snarkKeyPath,
    snarkKeyCid,
  })
  return zkWallet
}
