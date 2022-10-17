import fs from 'fs'
import { makePathAbsolute } from '@zkopru/utils'
import { loadConfig } from '../../utils'
import { Config } from '../../../src/apps/coordinator/configurator/configurator'
import {
  ExampleConfigContext,
  Menu,
} from '../../../src/apps/coordinator/example-config/menu'
import {
  mockCreateWallet,
  mockOutputPath,
  mockSetDB,
  mockSetPublicUrl,
  mockSetWebsocket,
} from './mocksForExampleConfig'
import { ethers } from 'ethers'

const COORDINATOR_CONFIG = './tests/configuration/coordinator.test.json'

describe('example-config', () => {
  let context: ExampleConfigContext
  let option

  beforeAll(async () => {
    // init context and option
    const config = loadConfig(COORDINATOR_CONFIG) as Config
    const exampleConfig = {
      ...config,
      publicUrls: `127.0.0.1:${config.port}`,
    }
    context = {
      config: exampleConfig,
      outputPath: makePathAbsolute('./example-config.json'),
    }
    option = {
      base: undefined,
      onCancel: handleAfter,
    }
  })

  async function handleAfter() {}

  afterEach(async () => {
    await handleAfter()
  })

  describe('CreateWallet', () => {
    const passwordFile = './tests/configuration/password-file.secret'

    it('create a wallet', async () => {
      const mockedWallet = mockCreateWallet(option)
      mockedWallet.ask.mockResolvedValue({
        create: true,
        password: 'securePassword',
        passwordFile: passwordFile,
      })
      const ret = await mockedWallet.run(context)
      expect(ret.next).toEqual(Menu.SET_PUBLIC_URLS)
      expect(ret.context.config.keystore).toBeDefined()
      expect(ret.context.config.passwordFile).toEqual(passwordFile)

      // make sure it's a valid keystore
      const psw = fs.readFileSync(ret.context.config.passwordFile!)
      const wallet = ethers.Wallet.fromEncryptedJsonSync(
        ret.context.config.keystore!.toString(),
        psw.toString(),
      )
      expect(await wallet._isSigner).toBe(true)
    })

    it('not to create a wallet', async () => {
      const mockedWallet = mockCreateWallet(option)
      mockedWallet.ask.mockResolvedValue({
        create: false,
      })
      const ret = await mockedWallet.run(context)
      expect(ret.next).toEqual(Menu.SET_PUBLIC_URLS)
      expect(ret.context.config.passwordFile).toBeUndefined()
    })
  })

  describe('setPublicUrl', () => {
    it('input a public url', async () => {
      const mockedSetPublicUrl = mockSetPublicUrl(option)
      mockedSetPublicUrl.ask.mockResolvedValue({
        update: true,
        urls: '127.0.0.1:9999',
      })
      const ret = await mockedSetPublicUrl.run(context)
      expect(ret.next).toEqual(Menu.SET_WEBSOCKET)
      expect(ret.context.config.publicUrls).toEqual('127.0.0.1:9999')
    })

    it('set a public url with url in config', async () => {
      const mockedSetPublicUrl = mockSetPublicUrl(option)
      mockedSetPublicUrl.ask.mockResolvedValue({
        update: false,
      })
      const ret = await mockedSetPublicUrl.run(context)
      expect(ret.next).toEqual(Menu.SET_WEBSOCKET)
      expect(ret.context.config.publicUrls).toEqual('127.0.0.1:8888')
    })
  })

  describe('setWebsocket', () => {
    jest.setTimeout(10000)
    it('input a websocket', async () => {
      const websocket = 'ws://localhost:8545'
      const mockedSetWebsocket = mockSetWebsocket(option)
      mockedSetWebsocket.ask.mockResolvedValue({
        websocketUrl: websocket,
        confirm: true,
      })
      const ret = await mockedSetWebsocket.run(context)
      expect(ret.next).toEqual(Menu.SET_DB)
      expect(ret.context.config.provider).toEqual(websocket)
    })
  })

  describe('setDB', () => {
    const coordinatorDB = 'database-test.sqlite'
    it('set db name', async () => {
      const mockedSetDB = mockSetDB(option)
      mockedSetDB.ask.mockResolvedValue({
        dbType: 0,
        sqlite: coordinatorDB,
      })
      const ret = await mockedSetDB.run(context)
      expect(ret.next).toEqual(Menu.OUTPUT_PATH)
      expect(ret.context.config.sqlite).toEqual(makePathAbsolute(coordinatorDB))
    })
  })

  describe('setOutputPath', () => {
    it('set config name', async () => {
      const configPath = 'config-test.json'
      const mockedOutputPath = mockOutputPath(option)
      mockedOutputPath.ask.mockResolvedValue({
        outputPath: configPath,
      })
      const ret = await mockedOutputPath.run(context)
      expect(ret.next).toEqual(Menu.COMPLETE)
      expect(ret.context.outputPath).toEqual(makePathAbsolute(configPath))
    })
  })
})
