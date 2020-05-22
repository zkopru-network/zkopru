#!/usr/bin/env node

/* eslint-disable no-case-declarations */
import { NetworkStatus } from '@zkopru/core'
import { Menu, Context, Config } from './configurator'
import Splash from './menus/splash'
import ConnectWeb3 from './menus/connect-web3'
import LoadDatabase from './menus/load-database'
import LoadCoordinator from './menus/load-coordinator'
import ConfigureAccount from './menus/config-account'
import SaveConfig from './menus/save-config'
import { Coordinator } from '..'

let coordinator: Coordinator

const defaultOnCancel = async () => {
  if (coordinator) await coordinator.stop()
  process.exit()
}

export async function getCoordinator(
  config: Config,
  onError?: () => Promise<void>,
): Promise<Coordinator> {
  const onCancel = onError || defaultOnCancel
  let context: Context = {
    menu: Menu.SPLASH,
    networkStatus: NetworkStatus.STOPPED,
  }
  const menus = {}
  menus[Menu.SPLASH] = new Splash(config, onCancel)
  menus[Menu.CONNECT_WEB3] = new ConnectWeb3(config, onCancel)
  menus[Menu.CONFIG_ACCOUNT] = new ConfigureAccount(config, onCancel)
  menus[Menu.SAVE_CONFIG] = new SaveConfig(config, onCancel)
  menus[Menu.LOAD_DATABASE] = new LoadDatabase(config, onCancel)
  menus[Menu.LOAD_COORDINATOR] = new LoadCoordinator(config, onCancel)
  while (context.menu !== Menu.COMPLETE_SETUP) {
    const menu = menus[context.menu]
    if (menu) {
      context = await menu.run(context)
    } else {
      break
    }
  }
  if (!context.coordinator) throw Error('Coordinator is not configured')
  coordinator = context.coordinator
  return coordinator
}
