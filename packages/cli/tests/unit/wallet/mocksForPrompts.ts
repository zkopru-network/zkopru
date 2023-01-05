/* eslint-disable no-case-declarations */

import { PromptApp } from '@zkopru/utils'
import { ZkWallet } from '@zkopru/zk-wizard'
import { Context } from '../../../src/apps/wallet/prompts/index'
import DepositEther from '../../../src/apps/wallet/prompts/menus/account-detail-deposit-eth'
import Deposit from '../../../src/apps/wallet/prompts/menus/account-detail-deposit'
import TopMenu from '../../../src/apps/wallet/prompts/menus/top-menus'
import AccountDetail from '../../../src/apps/wallet/prompts/menus/account-detail'
import WithdrawableList from '../../../src/apps/wallet/prompts/menus/account-detail-withdrawable-list'
import Withdraw from '../../../src/apps/wallet/prompts/menus/account-detail-withdraw'
import WithdrawRequest from '../../../src/apps/wallet/prompts/menus/account-detail-withdraw-request-menu'
import WithdrawRequestEth from '../../../src/apps/wallet/prompts/menus/account-detail-withdraw-request-eth'
import TransferMenu from '../../../src/apps/wallet/prompts/menus/account-detail-transfer-menu'
import TransferEth from '../../../src/apps/wallet/prompts/menus/account-detail-transfer-eth'
import AtomicSwap from '../../../src/apps/wallet/prompts/menus/account-detail-swap'
import AtomicSwapTake from '../../../src/apps/wallet/prompts/menus/account-detail-swap-take'
import AtomicSwapTakeEth from '../../../src/apps/wallet/prompts/menus/account-detail-swap-take-eth'
import AtomicSwapGiveEth from '../../../src/apps/wallet/prompts/menus/account-detail-swap-give-eth'

export function mockDepositEther(
  option: any,
): jest.Mocked<PromptApp<Context, ZkWallet>> {
  const obj = new DepositEther(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, ZkWallet>>
  mockedObj.ask = jest.fn()
  return mockedObj
}

export function mockDeposit(
  option: any,
): jest.Mocked<PromptApp<Context, ZkWallet>> {
  const obj = new Deposit(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, ZkWallet>>
  mockedObj.ask = jest.fn()
  return mockedObj
}

export function mockAtomicSwapGiveEth(
  option: any,
): jest.Mocked<PromptApp<Context, ZkWallet>> {
  const obj = new AtomicSwapGiveEth(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, ZkWallet>>
  mockedObj.ask = jest.fn()
  return mockedObj
}
export function mockAtomicSwapTakeEth(
  option: any,
): jest.Mocked<PromptApp<Context, ZkWallet>> {
  const obj = new AtomicSwapTakeEth(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, ZkWallet>>
  mockedObj.ask = jest.fn()
  return mockedObj
}
export function mockAtomicSwapTake(
  option: any,
): jest.Mocked<PromptApp<Context, ZkWallet>> {
  const obj = new AtomicSwapTake(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, ZkWallet>>
  mockedObj.ask = jest.fn()
  return mockedObj
}
export function mockAtomicSwap(
  option: any,
): jest.Mocked<PromptApp<Context, ZkWallet>> {
  const obj = new AtomicSwap(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, ZkWallet>>
  mockedObj.ask = jest.fn()
  return mockedObj
}
export function mockTransferEth(
  option: any,
): jest.Mocked<PromptApp<Context, ZkWallet>> {
  const obj = new TransferEth(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, ZkWallet>>
  mockedObj.ask = jest.fn()
  return mockedObj
}
export function mockTransferMenu(
  option: any,
): jest.Mocked<PromptApp<Context, ZkWallet>> {
  const obj = new TransferMenu(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, ZkWallet>>
  mockedObj.ask = jest.fn()
  return mockedObj
}
export function mockWithdrawRequestEth(
  option: any,
): jest.Mocked<PromptApp<Context, ZkWallet>> {
  const obj = new WithdrawRequestEth(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, ZkWallet>>
  mockedObj.ask = jest.fn()
  return mockedObj
}
export function mockWithdrawRequest(
  option: any,
): jest.Mocked<PromptApp<Context, ZkWallet>> {
  const obj = new WithdrawRequest(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, ZkWallet>>
  mockedObj.ask = jest.fn()
  return mockedObj
}
export function mockWithdraw(
  option: any,
): jest.Mocked<PromptApp<Context, ZkWallet>> {
  const obj = new Withdraw(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, ZkWallet>>
  mockedObj.ask = jest.fn()
  return mockedObj
}
export function mockWithdrawableList(
  option: any,
): jest.Mocked<PromptApp<Context, ZkWallet>> {
  const obj = new WithdrawableList(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, ZkWallet>>
  mockedObj.ask = jest.fn()
  return mockedObj
}
export function mockAccountDetail(
  option: any,
): jest.Mocked<PromptApp<Context, ZkWallet>> {
  const obj = new AccountDetail(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, ZkWallet>>
  mockedObj.ask = jest.fn()
  return mockedObj
}
export function mockTopMenu(
  option: any,
): jest.Mocked<PromptApp<Context, ZkWallet>> {
  const obj = new TopMenu(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, ZkWallet>>
  mockedObj.ask = jest.fn()
  return mockedObj
}
