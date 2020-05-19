#!/usr/bin/env node

/* eslint-disable no-case-declarations */
import yargs from 'yargs'
import { NetworkStatus } from '@zkopru/core'
import { Menu, Context, Config } from './app'
import Splash from './menus/splash'
import ConnectWeb3 from './menus/connect-web3'
import DownloadKeys from './menus/download-keys'
import LoadDatabase from './menus/load-database'
import LoadHDWallet from './menus/load-hdwallet'
import LoadNode from './menus/load-node'
import SelectAccount from './menus/select-account'
import TrackingAccount from './menus/config-tracking-accounts'
import NodeSync from './menus/node-sync'

const { argv }: { argv: Config } = yargs
  .scriptName('zk-wizard')
  .usage('$0 <command> [args]')
  .options({
    fullnode: {
      type: 'boolean',
      default: false,
      alias: 'f',
      describe: 'Run a full-node zkopru wallet',
    },
    develop: {
      type: 'boolean',
      default: false,
      alias: 'd',
      describe: 'Run a develop version',
    },
    networkId: {
      type: 'number',
      alias: 'n',
      default: 1,
    },
    chainId: {
      type: 'number',
      alias: 'c',
      default: 1,
    },
    address: {
      type: 'string',
      alias: 'a',
      default: '0x7C728214be9A0049e6a86f2137ec61030D0AA964',
    },
    bootstrap: {
      type: 'string',
      alias: 'b',
      default: 'https://bootstrap.zkopru.network',
    },
    websocket: {
      type: 'string',
      alias: 'ws',
      default: 'ws://ws.zkopru.network',
    },
    keys: {
      type: 'string',
      default: 'keys',
      describe: 'Path to store SNARK keys',
    },
    db: {
      type: 'string',
      default: 'db',
    },
    mnemonic: {
      type: 'string',
      default: undefined,
    },
  })
  .help()

const onCancel = () => {
  process.exit()
}

const main = async () => {
  let app: Context = { menu: Menu.SPLASH, networkStatus: NetworkStatus.STOPPED }
  const menus = {}
  menus[Menu.SPLASH] = new Splash(argv, onCancel)
  menus[Menu.CONNECT_WEB3] = new ConnectWeb3(argv, onCancel)
  menus[Menu.DOWNLOAD_KEYS] = new DownloadKeys(argv, onCancel)
  menus[Menu.LOAD_DATABASE] = new LoadDatabase(argv, onCancel)
  menus[Menu.LOAD_HDWALLET] = new LoadHDWallet(argv, onCancel)
  menus[Menu.CONFIG_TRACKING_ACCOUNT] = new TrackingAccount(argv, onCancel)
  menus[Menu.LOAD_NODE] = new LoadNode(argv, onCancel)
  menus[Menu.NODE_SYNC] = new NodeSync(argv, onCancel)
  menus[Menu.SELECT_ACCOUNT] = new SelectAccount(argv, onCancel)
  while (app.menu !== Menu.EXIT) {
    const menu = menus[app.menu]
    if (menu) {
      app = await menu.run(app)
    } else {
      break
    }
  }
  onCancel()
}
;(async () => {
  await main()
})().catch(e => {
  console.error(e)
})
