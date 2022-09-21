/* eslint-disable no-case-declarations */
import { PromptApp } from '@zkopru/utils'
import CreateWallet from '../../../src/apps/coordinator/example-config/prompts/create-wallet'
import SetPublicUrl from '../../../src/apps/coordinator/example-config/prompts/set-public-url'
import SetWebsocket from '../../../src/apps/coordinator/example-config/prompts/set-websocket'
import SetDB from '../../../src/apps/coordinator/example-config/prompts/set-db'
import OutputPath from '../../../src/apps/coordinator/example-config/prompts/output-path'
import { ExampleConfigContext } from '../../../src/apps/coordinator/example-config/menu'

// mock prompt module
jest.mock('../../../../utils/src/prompt')

export function mockCreateWallet(
  option: any,
): jest.Mocked<PromptApp<ExampleConfigContext, void>> {
  const obj = new CreateWallet(option)
  const mockedObj = obj as jest.Mocked<PromptApp<ExampleConfigContext, void>>
  mockedObj.ask = jest.fn()
  return mockedObj
}

export function mockSetPublicUrl(
  option: any,
): jest.Mocked<PromptApp<ExampleConfigContext, void>> {
  const obj = new SetPublicUrl(option)
  const mockedObj = obj as jest.Mocked<PromptApp<ExampleConfigContext, void>>
  mockedObj.ask = jest.fn()
  return mockedObj
}

export function mockSetWebsocket(
  option: any,
): jest.Mocked<PromptApp<ExampleConfigContext, void>> {
  const obj = new SetWebsocket(option)
  const mockedObj = obj as jest.Mocked<PromptApp<ExampleConfigContext, void>>
  mockedObj.ask = jest.fn()
  return mockedObj
}

export function mockSetDB(
  option: any,
): jest.Mocked<PromptApp<ExampleConfigContext, void>> {
  const obj = new SetDB(option)
  const mockedObj = obj as jest.Mocked<PromptApp<ExampleConfigContext, void>>
  mockedObj.ask = jest.fn()
  return mockedObj
}

export function mockOutputPath(
  option: any,
): jest.Mocked<PromptApp<ExampleConfigContext, void>> {
  const obj = new OutputPath(option)
  const mockedObj = obj as jest.Mocked<PromptApp<ExampleConfigContext, void>>
  mockedObj.ask = jest.fn()
  return mockedObj
}
