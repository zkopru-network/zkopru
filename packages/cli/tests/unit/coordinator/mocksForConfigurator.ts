/* eslint-disable no-case-declarations */
import { PromptApp } from '@zkopru/utils'
import ConfigureAccount from '../../../src/apps/coordinator/configurator/config-prompts/config-account'
import LoadCoordinator from '../../../src/apps/coordinator/configurator/config-prompts/load-coordinator'
import LoadDatabase from '../../../src/apps/coordinator/configurator/config-prompts/load-database'
import SaveConfig from '../../../src/apps/coordinator/configurator/config-prompts/save-config'
import {
  Config,
  Context,
} from '../../../src/apps/coordinator/configurator/configurator'

// jest.mock('../../../../core/src/node/zkopru-node')
// jest.mock('../../../../zk-wizard/src/zk-wallet-account')

// mock prompt module
jest.mock('../../../../utils/src/prompt')

export function mockConfigureAccount(
  option: any,
): jest.Mocked<PromptApp<Context, Config>> {
  const obj = new ConfigureAccount(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, Config>>
  mockedObj.ask = jest.fn()
  return mockedObj
}

export function mockSaveConfig(
  option: any,
): jest.Mocked<PromptApp<Context, Config>> {
  const obj = new SaveConfig(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, Config>>
  mockedObj.ask = jest.fn()
  return mockedObj
}

export function mockLoadDatabase(
  option: any,
): jest.Mocked<PromptApp<Context, Config>> {
  const obj = new LoadDatabase(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, Config>>
  mockedObj.ask = jest.fn()
  return mockedObj
}

export function mockLoadCoordinator(
  option: any,
): jest.Mocked<PromptApp<Context, Config>> {
  const obj = new LoadCoordinator(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, Config>>
  mockedObj.ask = jest.fn()
  return mockedObj
}
