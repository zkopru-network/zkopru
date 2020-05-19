#!/usr/bin/env node

/* eslint-disable no-case-declarations */
import yargs from 'yargs'
import { NetworkStatus } from '@zkopru/core'
import fs from 'fs-extra'
import { Menu, Context, Config } from './app'
import Splash from './menus/splash'
import ConnectWeb3 from './menus/connect-web3'
import LoadDatabase from './menus/load-database'
import LoadCoordinator from './menus/load-coordinator'
import { Coordinator } from '..'
import ConfigureAccount from './menus/config-account'

const { argv } = yargs
  .scriptName('zkopru-coordinator')
  .usage('$0 <command> [args]')
  .options({
    address: {
      type: 'string',
      alias: 'a',
      default: '0x7C728214be9A0049e6a86f2137ec61030D0AA964',
    },
    bootstrap: {
      type: 'boolean',
      alias: 'b',
      default: true,
    },
    websocket: {
      type: 'string',
      alias: 'ws',
      default: 'ws://ws.zkopru.network',
    },
    db: {
      type: 'string',
      default: 'db',
    },
    maxBytes: {
      type: 'number',
      default: 131072,
    },
    priceMultiplier: {
      type: 'number',
      default: 48,
    },
    port: {
      type: 'number',
      default: 8888,
    },
    config: {
      type: 'string',
      describe:
        'You can skip interactive booting up process with JSON configuration file',
    },
    password: {
      type: 'string',
    },
  })
  .help()

let coordinator: Coordinator

const onCancel = async () => {
  if (coordinator) await coordinator.stop()
  process.exit()
}

const main = async () => {
  let app: Context = { menu: Menu.SPLASH, networkStatus: NetworkStatus.STOPPED }
  let config: Config = argv
  if (argv.config) {
    config = JSON.parse(fs.readFileSync(argv.config).toString('utf8'))
    if (!config.keystore || !config.password)
      throw Error(
        'You should setup the keystore and password in the config file',
      )
  }
  const menus = {}
  menus[Menu.SPLASH] = new Splash(config, onCancel)
  menus[Menu.CONNECT_WEB3] = new ConnectWeb3(config, onCancel)
  menus[Menu.CONFIG_ACCOUNT] = new ConfigureAccount(config, onCancel)
  menus[Menu.LOAD_DATABASE] = new LoadDatabase(config, onCancel)
  menus[Menu.LOAD_COORDINATOR] = new LoadCoordinator(config, onCancel)
  while (app.menu !== Menu.COMPLETE_SETUP) {
    const menu = menus[app.menu]
    if (menu) {
      app = await menu.run(app)
    } else {
      break
    }
  }

  if (!app.provider) throw Error('websocket provider is not set')
  if (!app.db) throw Error('Database is not loaded')
  return new Promise(res => {
    if (!app.coordinator) throw Error('Failed to load coordinator')
    app.coordinator.start()
    app.coordinator.on('stop', res)
  })
}
;(async () => {
  await main()
})().catch(e => {
  console.error(e)
})
