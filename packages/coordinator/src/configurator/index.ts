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
  let next = Menu.SPLASH
  let context: Context = {
    networkStatus: NetworkStatus.STOPPED,
  }
  const apps = {}
  const option = {
    base: config,
    onCancel,
  }
  apps[Menu.SPLASH] = new Splash(option)
  apps[Menu.CONNECT_WEB3] = new ConnectWeb3(option)
  apps[Menu.CONFIG_ACCOUNT] = new ConfigureAccount(option)
  apps[Menu.SAVE_CONFIG] = new SaveConfig(option)
  apps[Menu.LOAD_DATABASE] = new LoadDatabase(option)
  apps[Menu.LOAD_COORDINATOR] = new LoadCoordinator(option)
  while (next !== Menu.COMPLETE_SETUP) {
    const app = apps[next]
    if (app) {
      const result = await app.run(context)
      next = result.next
      context = result.context
    } else {
      break
    }
  }
  if (!context.coordinator) throw Error('Coordinator is not configured')
  coordinator = context.coordinator
  return coordinator
}
