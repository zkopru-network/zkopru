import fs from 'fs'
import { PromptApp } from '@zkopru/utils'
import LoadDatabase from '../src/apps/wallet/configurator/menus/load-database'
import LoadHDWallet from '../src/apps/wallet/configurator/menus/load-hdwallet'
import TrackingAccount from '../src/apps/wallet/configurator/menus/config-tracking-accounts'
import SaveConfig from '../src/apps/wallet/configurator/menus/save-config'
import { Config, Context } from '../src/apps/wallet/configurator/configurator'

export function mockedLoadDatabase(
  option: any,
): jest.Mocked<PromptApp<Context, Config>> {
  const obj = new LoadDatabase(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, Config>>
  mockedObj.ask = jest.fn()
  return mockedObj
}

export function mockedLoadHDWallet(
  option: any,
): jest.Mocked<PromptApp<Context, Config>> {
  const obj = new LoadHDWallet(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, Config>>
  mockedObj.ask = jest.fn()
  return mockedObj
}

export function mockedTrackingAccount(
  option: any,
): jest.Mocked<PromptApp<Context, Config>> {
  const obj = new TrackingAccount(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, Config>>
  mockedObj.ask = jest.fn()
  return mockedObj
}

export function mockedSaveConfig(
  option: any,
): jest.Mocked<PromptApp<Context, Config>> {
  const obj = new SaveConfig(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, Config>>
  mockedObj.ask = jest.fn()
  return mockedObj
}

export function loadConfig(path: string): Config {
  const config = {
    ...JSON.parse(fs.readFileSync(path).toString('utf8')),
  }
  if (!config) {
    throw Error('incorrect config path')
  }
  return config
}
