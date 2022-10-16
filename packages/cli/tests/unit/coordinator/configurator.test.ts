import fs from 'fs'
import {  WebSocketProvider } from '@ethersproject/providers'
import { NetworkStatus } from '@zkopru/core'
import { loadConfig } from '../../utils'
import {
  Config,
  Context,
  Menu,
} from '../../../src/apps/coordinator/configurator/configurator'
import ConnectWeb3 from '../../../src/apps/coordinator/configurator/config-prompts/connect-web3'
import {
  mockConfigureAccount,
  mockLoadDatabase,
  mockSaveConfig,
} from './mocksForConfigurator'
import ConfigureAccount from '../../../src/apps/coordinator/configurator/config-prompts/config-account'
import SaveConfig from '../../../src/apps/coordinator/configurator/config-prompts/save-config'
import LoadDatabase from '../../../src/apps/coordinator/configurator/config-prompts/load-database'
import LoadCoordinator from '../../../src/apps/coordinator/configurator/config-prompts/load-coordinator'
import { Context as NodeContext } from '../../context'
import { getCtx } from '../setupTest'
import { Web3Provider } from '@ethersproject/providers/src.ts/web3-provider'

const COORDINATOR_CONFIG = './tests/coordinator.test.json'
const COORDINATOR_CONFIG_ONLY_PROVIDER =
  './tests/coordinator-only-provider.test.json'
const NEW_COORDINATOR_CONFIG_PATH = './tests/coordinator-tmp.json'
const SQLITE_DB_NAME = 'zkopru-coordinator-configurator'

describe('configurator', () => {
  jest.setTimeout(100000)

  let ctx: NodeContext
  let context: Context
  let option

  beforeAll(async () => {
    // to avoid that db and config was not deleted in previous testing
    await handleAfter()

    ctx = await getCtx()

    // init context and option
    const config = loadConfig(COORDINATOR_CONFIG) as Config
    context = {
      networkStatus: NetworkStatus.STOPPED,
      provider: ctx.provider,
    }
    config.port = 9999
    option = {
      base: config,
      onCancel: handleAfter,
    }
    option.base.address = ctx.contract.address
  })

  async function handleAfter() {
    if (fs.existsSync(NEW_COORDINATOR_CONFIG_PATH)) {
      fs.unlinkSync(NEW_COORDINATOR_CONFIG_PATH)
    }
  }

  afterEach(async () => {
    await handleAfter()
  })

  describe('ConnectWeb3', () => {
    it('with default provider', async () => {
      const localContext = {
        networkStatus: NetworkStatus.STOPPED,
      }

      const connection = new ConnectWeb3(option)
      const ret = await connection.run(localContext)
      expect(ret.next).toEqual(Menu.CONFIG_ACCOUNT)

      let provider = ret.context.provider as Web3Provider
      let wsProvider = (provider.provider as any)as WebSocketProvider
      expect(wsProvider.connection.url).toEqual(option.base.provider)
    })

    it('with websocket provider', async () => {
      const localContext = {
        networkStatus: NetworkStatus.STOPPED,
      }
      const wsProviderUrl = 'ws://localhost:8545'
      option.base.provider = wsProviderUrl

      const connection = new ConnectWeb3(option)
      const ret = await connection.run(localContext)

      let provider = ret.context.provider as Web3Provider
      let wsProvider = (provider.provider as any)as WebSocketProvider
      expect(wsProvider.connection.url).toEqual(wsProviderUrl)
    })
  })

  describe('ConfigureAccount', () => {
    let contextConfigureAccount: Context

    beforeAll(async () => {
      contextConfigureAccount = context
    })

    it('import from keystore', async () => {
      const configureAccount = new ConfigureAccount(option)
      const ret = await configureAccount.run(contextConfigureAccount)
      expect(ret.next).toEqual(Menu.LOAD_DATABASE)
      expect(await ret.context.account?.getAddress()).toEqual(
        '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1',
      )
      expect(ret.context.keystore).toBeDefined()
      expect(ret.context.keystore!['address']).toEqual(
        '90F8bf6A479f320ead074411a4B0e7944Ea8c9C1'.toLocaleLowerCase(),
      )
    })

    it('import from keystore and password from a password file', async () => {
      const defaultPsw = option.base.password
      option.base.password = undefined
      option.base.passwordFile = './tests/password-file'

      const configureAccount = new ConfigureAccount(option)
      const ret = await configureAccount.run(contextConfigureAccount)
      expect(ret.next).toEqual(Menu.LOAD_DATABASE)
      expect(await ret.context.account?.getAddress()).toEqual(
        '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1',
      )
      expect(ret.context.keystore).toBeDefined()
      expect(ret.context.keystore!['address']).toEqual(
        '90F8bf6A479f320ead074411a4B0e7944Ea8c9C1'.toLocaleLowerCase(),
      )

      // recovery
      option.base.password = defaultPsw
      option.base.passwordFile = undefined
    })

    it('import from keystore and password from a password file', async () => {
      const defaultPsw = option.base.password
      option.base.password = undefined

      const configureAccount = new ConfigureAccount(option)
      await expect(
        configureAccount.run(contextConfigureAccount),
      ).rejects.toThrowError('Password is not configured')

      // recovery
      option.base.password = defaultPsw
    })

    it('import from a private key', async () => {
      const defaultConfig = option.base
      option.base = loadConfig(COORDINATOR_CONFIG_ONLY_PROVIDER) as Config

      const mockedConfig = mockConfigureAccount(option)
      mockedConfig.ask.mockResolvedValue({
        choice: 0,
        privateKey:
          '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d',
        password: 'helloworld',
        retyped: 'helloworld',
      })
      const ret = await mockedConfig.run(contextConfigureAccount)
      expect(ret.next).toEqual(Menu.SAVE_CONFIG)
      expect(await ret.context.account?.getAddress()).toEqual(
        '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1',
      )
      expect(ret.context.keystore!['address']).toEqual(
        '90F8bf6A479f320ead074411a4B0e7944Ea8c9C1'.toLocaleLowerCase(),
      )

      // recovery
      option.base = defaultConfig
    })

    it('select to create a new account', async () => {
      const defaultConfig = option.base
      option.base = loadConfig(COORDINATOR_CONFIG_ONLY_PROVIDER) as Config

      const mockedConfig = mockConfigureAccount(option)
      mockedConfig.ask.mockResolvedValue({
        choice: 1,
        password: 'helloworld',
        retyped: 'helloworld',
      })
      const ret = await mockedConfig.run(contextConfigureAccount)
      expect(ret.next).toEqual(Menu.SAVE_CONFIG)
      const address = await ret.context.account?.getAddress()
      expect(address).toBeDefined()
      expect(ret.context.keystore!['address']).toBeDefined()
      expect(address?.slice(2).toLocaleLowerCase()).toEqual(
        ret.context.keystore!['address'],
      )

      // recovery
      option.base = defaultConfig
    })

    it('create a new account by config.daemon ', async () => {
      const defaultConfig = option.base
      option.base = loadConfig(COORDINATOR_CONFIG_ONLY_PROVIDER) as Config
      option.base.daemon = true

      const mockedConfig = mockConfigureAccount(option)
      mockedConfig.ask.mockResolvedValue({
        password: 'helloworld',
        retyped: 'helloworld',
      })
      const ret = await mockedConfig.run(contextConfigureAccount)
      expect(ret.next).toEqual(Menu.SAVE_CONFIG)
      const address = await ret.context.account?.getAddress()
      expect(address).toBeDefined()
      expect(ret.context.keystore!['address']).toBeDefined()
      expect(address?.slice(2).toLocaleLowerCase()).toEqual(
        ret.context.keystore!['address'],
      )

      // recovery
      option.base = defaultConfig
    })
  })

  describe('SaveConfig', () => {
    let contextConfig: Context

    beforeAll(async () => {
      const configureAccount = new ConfigureAccount(option)
      let ret = await configureAccount.run(context)
      contextConfig = ret.context
    })

    afterEach(() => {
      if (fs.existsSync(NEW_COORDINATOR_CONFIG_PATH)) {
        fs.unlinkSync(NEW_COORDINATOR_CONFIG_PATH)
      }
    })

    it('not saving config', async () => {
      const mockedSaveConfig = mockSaveConfig(option)
      mockedSaveConfig.ask.mockResolvedValue({
        save: false,
      })
      const ret = await mockedSaveConfig.run(contextConfig)
      expect(ret.next).toEqual(Menu.LOAD_DATABASE)
    })

    it('save config with password', async () => {
      const mockedSaveConfig = mockSaveConfig(option)
      mockedSaveConfig.ask.mockResolvedValue({
        save: true,
        savePassword: true,
        retyped: 'helloworld',
        filePath: NEW_COORDINATOR_CONFIG_PATH,
        overwrite: true,
      })
      const ret = await mockedSaveConfig.run(contextConfig)
      expect(ret.next).toEqual(Menu.LOAD_DATABASE)
      expect(fs.existsSync(NEW_COORDINATOR_CONFIG_PATH)).toBe(true)
    })

    it('save config with overwriting existing one', async () => {
      fs.writeFileSync(NEW_COORDINATOR_CONFIG_PATH, JSON.stringify(option.base))
      expect(fs.existsSync(NEW_COORDINATOR_CONFIG_PATH)).toBe(true)

      const mockedSaveConfig = mockSaveConfig(option)
      mockedSaveConfig.ask.mockResolvedValue({
        save: true,
        savePassword: true,
        retyped: 'helloworld',
        filePath: NEW_COORDINATOR_CONFIG_PATH,
        overwrite: true,
      })
      const ret = await mockedSaveConfig.run(contextConfig)
      expect(ret.next).toEqual(Menu.LOAD_DATABASE)
      expect(fs.existsSync(NEW_COORDINATOR_CONFIG_PATH)).toBe(true)
    })
    it('provide an undefined provider and keystore', async () => {
      const saveConfig = new SaveConfig(option)

      const defaultProvider = contextConfig.provider
      contextConfig.provider = undefined
      await expect(saveConfig.run(contextConfig)).rejects.toThrowError(
        'provider and keystore is not configured',
      )
      contextConfig.provider = defaultProvider

      const defaultKeystore = contextConfig.keystore
      contextConfig.keystore = undefined
      await expect(saveConfig.run(contextConfig)).rejects.toThrowError(
        'provider and keystore is not configured',
      )
      contextConfig.keystore = defaultKeystore
    })
  })

  describe('LoadDatabase', () => {
    let contextLoadDB: Context
    let mockedLoadDB
    let defaultConfig

    beforeAll(async () => {
      const configureAccount = new ConfigureAccount(option)
      let ret = await configureAccount.run(context)
      contextLoadDB = ret.context
    })

    beforeEach(async () => {
      defaultConfig = option.base
      const configWithoutDB = loadConfig(
        COORDINATOR_CONFIG_ONLY_PROVIDER,
      ) as Config
      option.base = configWithoutDB
      option.base.address = ctx.contract.address
      mockedLoadDB = mockLoadDatabase(option)
    })

    afterEach(async () => {
      if (fs.existsSync(SQLITE_DB_NAME)) {
        fs.unlinkSync(SQLITE_DB_NAME)
      }
      // recover config
      option.base = defaultConfig
    })

    it('create a new db by given a path', async () => {
      option.base = defaultConfig
      const db = new LoadDatabase(option)
      const ret = await db.run(contextLoadDB)
      expect(ret.next).toEqual(Menu.LOAD_COORDINATOR)
      expect(ret.context.db).toBeDefined()
    })

    it('create a new db', async () => {
      mockedLoadDB = mockLoadDatabase(option)
      mockedLoadDB.ask.mockResolvedValue({
        dbType: 1,
        dbName: SQLITE_DB_NAME,
      })

      const ret = await mockedLoadDB.run(contextLoadDB)
      expect(ret.next).toEqual(Menu.LOAD_COORDINATOR)
      expect(ret.context.db).toBeDefined()
    })

    it('create a new db with overwriting the existing db', async () => {
      mockedLoadDB.ask.mockResolvedValue({
        dbType: 1,
        dbName: SQLITE_DB_NAME,
      })
      let ret = await mockedLoadDB.run(contextLoadDB)
      expect(ret.context.db).toBeDefined()

      mockedLoadDB.ask.mockResolvedValue({
        dbType: 1,
        dbName: SQLITE_DB_NAME,
        overwrite: true,
      })
      ret = await mockedLoadDB.run(contextLoadDB)
      expect(ret.next).toEqual(Menu.LOAD_COORDINATOR)
    })

    it('create a new db without overwriting the existing db', async () => {
      mockedLoadDB.ask.mockResolvedValue({
        dbType: 1,
        dbName: SQLITE_DB_NAME,
      })
      let ret = await mockedLoadDB.run(contextLoadDB)
      expect(ret.context.db).toBeDefined()

      mockedLoadDB.ask.mockResolvedValue({
        dbType: 1,
        dbName: SQLITE_DB_NAME,
        overwrite: false,
      })
      ret = await mockedLoadDB.run(contextLoadDB)
      expect(ret.next).toEqual(Menu.LOAD_COORDINATOR)
    })

    it('provide an undefined provider object', async () => {
      const defaultProvider = contextLoadDB.provider
      const db = new LoadDatabase(option)
      contextLoadDB.provider = undefined
      await expect(db.run(contextLoadDB)).rejects.toThrow(
        'Provider does not exist',
      )
      // recover provider object
      contextLoadDB.provider = defaultProvider
    })
  })

  describe('LoadCoordinator', () => {
    let contextLoadCoordinator: Context

    beforeAll(async () => {
      const configureAccount = new ConfigureAccount(option)
      let ret = await configureAccount.run(context)
      const db = new LoadDatabase(option)
      ret = await db.run(ret.context)
      contextLoadCoordinator = ret.context
    })

    it('run a coordinator', async () => {
      const coordinator = new LoadCoordinator(option)
      const ret = await coordinator.run(contextLoadCoordinator)
      expect(ret.next).toEqual(Menu.COMPLETE_SETUP)
      expect(ret.context.coordinator).toBeDefined()
      expect(ret.context.coordinator?.context.account).toEqual(
        contextLoadCoordinator.account,
      )
      expect(ret.context.coordinator?.context.config.maxBid).toEqual(
        option.base.maxBid,
      )
    })

    it('provide undefined provider, db and account obj', async () => {
      const defaultDB = contextLoadCoordinator.db
      const defaultProvider = contextLoadCoordinator.provider
      const defaultAccount = contextLoadCoordinator.account

      const coordinator = new LoadCoordinator(option)

      contextLoadCoordinator.provider = undefined
      await expect(
        coordinator.run(contextLoadCoordinator),
      ).rejects.toThrowError('Websocket provider does not exist')
      contextLoadCoordinator.provider = defaultProvider

      contextLoadCoordinator.db = undefined
      await expect(
        coordinator.run(contextLoadCoordinator),
      ).rejects.toThrowError('Database does not exist')
      contextLoadCoordinator.db = defaultDB

      contextLoadCoordinator.account = undefined
      await expect(
        coordinator.run(contextLoadCoordinator),
      ).rejects.toThrowError('Account is not set')
      contextLoadCoordinator.account = defaultAccount
    })
  })
})
