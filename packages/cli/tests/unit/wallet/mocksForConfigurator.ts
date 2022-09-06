/* eslint-disable no-case-declarations */
import { NetworkStatus } from '@zkopru/core'
import { PromptApp } from '@zkopru/utils'
import { ZkWallet } from '@zkopru/zk-wizard'
import LoadDatabase from '../../../src/apps/wallet/configurator/menus/load-database'
import LoadHDWallet from '../../../src/apps/wallet/configurator/menus/load-hdwallet'
import TrackingAccount from '../../../src/apps/wallet/configurator/menus/config-tracking-accounts'
import SaveConfig from '../../../src/apps/wallet/configurator/menus/save-config'
import ConnectWeb3 from '../../../src/apps/wallet/configurator/menus/connect-web3'
import LoadNode from '../../../src/apps/wallet/configurator/menus/load-node'
import {
  Config,
  Context,
  Menu,
} from '../../../src/apps/wallet/configurator/configurator'
import { Address } from 'soltypes'
import assert from 'assert'
import { loadConfig } from '../../utils'

export async function getMockedZKWallet(
  walletConfig: string,
  onCancel: () => Promise<void>,
): Promise<ZkWallet> {
  let context: Context = {
    menu: Menu.SPLASH,
    networkStatus: NetworkStatus.STOPPED,
  }
  const option = {
    base: loadConfig(walletConfig),
    onCancel: onCancel,
  }

  let ret = await new ConnectWeb3(option).run(context)
  ret = await new LoadDatabase(option).run(ret.context)
  let mockedHdWallet = mockLoadHDWallet(option)
  mockedHdWallet.ask.mockResolvedValue({
    password: 'helloworld',
  })
  ret = await mockedHdWallet.run(ret.context)
  ret = await new TrackingAccount(option).run(ret.context)
  ret = await new LoadNode(option).run(ret.context)
  ret = await new SaveConfig(option).run(ret.context)
  if (context.menu === Menu.EXIT)
    throw Error('something wrong while preparing for zkWallet')
  context = ret.context

  const { db, wallet, node, accounts } = context
  const { erc20, erc721, snarkKeyPath, snarkKeyCid } = option.base
  assert(db, 'db')
  assert(wallet, 'wallet')
  assert(accounts, 'accounts')
  assert(node, 'node')
  const zkWallet = new ZkWallet({
    db,
    wallet,
    node,
    accounts,
    erc20: erc20?.map(Address.from) || [],
    erc721: erc721?.map(Address.from) || [],
    snarkKeyPath,
    snarkKeyCid,
  })
  return zkWallet
}

export function mockLoadDatabase(
  option: any,
): jest.Mocked<PromptApp<Context, Config>> {
  const obj = new LoadDatabase(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, Config>>
  mockedObj.ask = jest.fn()
  return mockedObj
}

export function mockLoadHDWallet(
  option: any,
): jest.Mocked<PromptApp<Context, Config>> {
  const obj = new LoadHDWallet(option)
  const mockedObj = obj as jest.Mocked<PromptApp<Context, Config>>
  mockedObj.ask = jest.fn()
  return mockedObj
}

export function mockTrackingAccount(
  option: any,
): jest.Mocked<PromptApp<Context, Config>> {
  const obj = new TrackingAccount(option)
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
