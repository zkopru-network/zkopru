/* eslint-disable no-case-declarations */
import { Coordinator } from '@zkopru/coordinator'
import { PromptApp } from '@zkopru/utils'
import AuctionMenu from '../../../src/apps/coordinator/prompts/auction-menu'
import Refund from '../../../src/apps/coordinator/prompts/auction/refund'
import UpdateMaxBid from '../../../src/apps/coordinator/prompts/auction/update-max-bid'
import UpdateUrl from '../../../src/apps/coordinator/prompts/auction/update-url'
import AutoCoordinate from '../../../src/apps/coordinator/prompts/auto-coordinate'
import CoordinatorInfo from '../../../src/apps/coordinator/prompts/coordinator-info'
import Layer1Details from '../../../src/apps/coordinator/prompts/layer1-details'
import SetupMenu from '../../../src/apps/coordinator/prompts/setup-menus'
import CommitDeposits from '../../../src/apps/coordinator/prompts/setup/commit-deposits'
import CompleteSetup from '../../../src/apps/coordinator/prompts/setup/complete-setup'
import Deregister from '../../../src/apps/coordinator/prompts/setup/deregister'
import RegisterVk from '../../../src/apps/coordinator/prompts/setup/register-vks'
import StopAutoCoordination from '../../../src/apps/coordinator/prompts/stop-auto-coordinate'
import TopMenu from '../../../src/apps/coordinator/prompts/top-menus'
import AuctionInfo from '../../../src/apps/coordinator/prompts/auction-info'
import { Context } from '../../../src/apps/coordinator/prompts'

// mock prompt module
jest.mock('../../../../utils/src/prompt')

export function mockTopMenu(
  option: any,
): jest.Mocked<PromptApp<Context, Coordinator>> {
  const obj = new TopMenu(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, Coordinator>>
  mockedObj.ask = jest.fn()
  return mockedObj
}

export function mockSetupMenu(
  option: any,
): jest.Mocked<PromptApp<Context, Coordinator>> {
  const obj = new SetupMenu(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, Coordinator>>
  mockedObj.ask = jest.fn()
  return mockedObj
}

export function mockRegisterVk(
  option: any,
): jest.Mocked<PromptApp<Context, Coordinator>> {
  const obj = new RegisterVk(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, Coordinator>>
  mockedObj.ask = jest.fn()
  return mockedObj
}

export function mockCompleteSetup(
  option: any,
): jest.Mocked<PromptApp<Context, Coordinator>> {
  const obj = new CompleteSetup(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, Coordinator>>
  mockedObj.ask = jest.fn()
  return mockedObj
}

export function mockCommitDeposits(
  option: any,
): jest.Mocked<PromptApp<Context, Coordinator>> {
  const obj = new CommitDeposits(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, Coordinator>>
  mockedObj.ask = jest.fn()
  return mockedObj
}

export function mockDeregister(
  option: any,
): jest.Mocked<PromptApp<Context, Coordinator>> {
  const obj = new Deregister(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, Coordinator>>
  mockedObj.ask = jest.fn()
  return mockedObj
}
export function mockAutoCoordinate(
  option: any,
): jest.Mocked<PromptApp<Context, Coordinator>> {
  const obj = new AutoCoordinate(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, Coordinator>>
  mockedObj.ask = jest.fn()
  return mockedObj
}
export function mockStopAutoCoordination(
  option: any,
): jest.Mocked<PromptApp<Context, Coordinator>> {
  const obj = new StopAutoCoordination(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, Coordinator>>
  mockedObj.ask = jest.fn()
  return mockedObj
}
export function mockLayer1Details(
  option: any,
): jest.Mocked<PromptApp<Context, Coordinator>> {
  const obj = new Layer1Details(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, Coordinator>>
  mockedObj.ask = jest.fn()
  return mockedObj
}

export function mockCoordinatorInfo(
  option: any,
): jest.Mocked<PromptApp<Context, Coordinator>> {
  const obj = new CoordinatorInfo(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, Coordinator>>
  mockedObj.ask = jest.fn()
  return mockedObj
}

export function mockAuctionInfo(
  option: any,
): jest.Mocked<PromptApp<Context, Coordinator>> {
  const obj = new AuctionInfo(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, Coordinator>>
  mockedObj.ask = jest.fn()
  return mockedObj
}
export function mockAuctionMenu(
  option: any,
): jest.Mocked<PromptApp<Context, Coordinator>> {
  const obj = new AuctionMenu(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, Coordinator>>
  mockedObj.ask = jest.fn()
  return mockedObj
}

export function mockUpdateUrl(
  option: any,
): jest.Mocked<PromptApp<Context, Coordinator>> {
  const obj = new UpdateUrl(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, Coordinator>>
  mockedObj.ask = jest.fn()
  return mockedObj
}

export function mockUpdateMaxBid(
  option: any,
): jest.Mocked<PromptApp<Context, Coordinator>> {
  const obj = new UpdateMaxBid(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, Coordinator>>
  mockedObj.ask = jest.fn()
  return mockedObj
}

export function mockRefund(
  option: any,
): jest.Mocked<PromptApp<Context, Coordinator>> {
  const obj = new Refund(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, Coordinator>>
  mockedObj.ask = jest.fn()
  return mockedObj
}
