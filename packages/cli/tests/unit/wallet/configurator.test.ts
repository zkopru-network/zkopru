import fs from 'fs'
import { JsonRpcProvider, WebSocketProvider } from '@ethersproject/providers'
import { NetworkStatus } from '@zkopru/core'
import { HDWallet } from '@zkopru/account'
import {
  mockLoadDatabase,
  mockLoadHDWallet,
  mockSaveConfig,
  mockTrackingAccount,
} from './mocksForConfigurator'
import {
  Context,
  Menu,
} from '../../../src/apps/wallet/configurator/configurator'
import ConnectWeb3 from '../../../src/apps/wallet/configurator/menus/connect-web3'
import DownloadKeys from '../../../src/apps/wallet/configurator/menus/download-keys'
import LoadDatabase from '../../../src/apps/wallet/configurator/menus/load-database'
import TrackingAccount from '../../../src/apps/wallet/configurator/menus/config-tracking-accounts'
import LoadNode from '../../../src/apps/wallet/configurator/menus/load-node'
import SaveConfig from '../../../src/apps/wallet/configurator/menus/save-config'
import { loadConfig } from '../../utils'

const WALLET_CONFIG = './tests/wallet.test.json'
const WALLET_CONFIG_ONLY_PROVIDER = './tests/wallet-only-provider.test.json'
const NEW_WALLET_CONFIG_PATH = './tests/wallet-temp.test.json'
const SQLITE_DB_NAME = 'zkwallet-db'
const MNEMONIC =
  'myth like bonus scare over problem client lizard pioneer submit female collect'
// the first account from above mnemonic
const ACCOUNT0_ADDR = '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1'

// mock prompt module
jest.mock('../../../../utils/src/prompt')

describe.only('configurator', () => {
  jest.setTimeout(20000)

  let context: Context
  let option

  beforeAll(async () => {
    // to avoid that db and config was not deleted in previous testing
    await handleAfter()

    // init context and option
    const config = loadConfig(WALLET_CONFIG)
    context = {
      menu: 0,
      networkStatus: NetworkStatus.STOPPED,
    }
    option = {
      base: config,
      onCancel: handleAfter,
    }
  })

  async function handleAfter() {
    if (fs.existsSync(SQLITE_DB_NAME)) {
      fs.unlinkSync(SQLITE_DB_NAME)
    }
    if (fs.existsSync(NEW_WALLET_CONFIG_PATH)) {
      fs.unlinkSync(NEW_WALLET_CONFIG_PATH)
    }
  }

  afterEach(async () => {
    await handleAfter()
  })

  describe('ConnectWeb3', () => {
    it('with default provider', async () => {
      // make sure the provider passed to `run` is undefined
      expect(context.provider).toBeUndefined()

      const connection = new ConnectWeb3(option)
      const ret = await connection.run(context)
      expect(ret.next).toEqual(Menu.DOWNLOAD_KEYS)

      let provider = ret.context.provider as JsonRpcProvider
      expect(provider.connection.url).toEqual(option.base.provider)
    })

    it('with websocket provider', async () => {
      const wsProviderUrl = 'ws:localhost:5001'
      option.base.provider = wsProviderUrl

      const connection = new ConnectWeb3(option)
      const ret = await connection.run(context)

      let wsProvider = ret.context.provider as WebSocketProvider
      expect(wsProvider.connection.url).toEqual(wsProviderUrl)
    })
  })

  describe('DownloadKeys', () => {
    it('with default snarkKeyCid', async () => {
      expect(option.base.snarkKeyCid).toBeDefined()
      const snarkKey = new DownloadKeys(option)
      const ret = await snarkKey.run(context)

      expect(ret.next).toEqual(Menu.LOAD_DATABASE)
      expect(ret.context).toStrictEqual(context)
    })

    it('with existing snarkKeyPath', async () => {
      const SNARK_KEY_PATH = './tests/fakeSnarkKeyDir'
      option.base.snarkKeyCid = undefined
      option.base.snarkKeyPath = SNARK_KEY_PATH

      const snarkKey = new DownloadKeys(option)
      let ret = await snarkKey.run(context)
      expect(ret.next).toEqual(Menu.LOAD_DATABASE)
      expect(fs.existsSync(SNARK_KEY_PATH)).toBe(true)

      // should get the same result if path existed already
      ret = await snarkKey.run(context)
      expect(ret.next).toEqual(Menu.LOAD_DATABASE)
      expect(fs.existsSync(SNARK_KEY_PATH)).toBe(true)

      // recovery
      fs.rmdirSync(SNARK_KEY_PATH)
    })

    it('with non-existing snarkKeyPath', async () => {
      option.base.snarkKeyCid = undefined
      option.base.snarkKeyPath = undefined
      const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {
        throw Error('process.exit(1)')
      }) as any)

      const snarkKey = new DownloadKeys(option)
      await expect(snarkKey.run(context)).rejects.toThrowError(
        'process.exit(1)',
      )
      expect(mockExit).toHaveBeenCalled()

      mockExit.mockRestore()
    })
  })

  describe('LoadDatabase', () => {
    let contextForLoadDB

    beforeAll(async () => {
      const connection = new ConnectWeb3(option)
      let ret = await connection.run(context)
      contextForLoadDB = ret.context
    })

    it('create a new sqlite db by a given sqlite path from json config', async () => {
      const db = new LoadDatabase(option)
      const ret = await db.run(contextForLoadDB)
      expect(ret.context.db).toBeDefined()
    })

    it('create a new sqlite db', async () => {
      const defaultConfig = option.base
      let configWithoutDB = loadConfig(WALLET_CONFIG_ONLY_PROVIDER)
      option.base = configWithoutDB
      const mockedDB = mockLoadDatabase(option)
      mockedDB.ask.mockResolvedValue({
        dbType: 1,
        dbName: SQLITE_DB_NAME,
        overwrite: true,
      }) // 1: SQLITE

      const ret = await mockedDB.run(contextForLoadDB)
      expect(ret.context.db).toBeDefined()

      // recover config
      option.base = defaultConfig
    })

    it('create a new sqlite db without overwriting existing one', async () => {
      // create a db first
      const db = new LoadDatabase(option)
      await db.run(contextForLoadDB)

      // create db again but without overwrite it
      const mockedDB = mockLoadDatabase(option)
      mockedDB.ask.mockResolvedValue({
        dbType: 1,
        dbName: SQLITE_DB_NAME,
        overwrite: false,
      })
      const ret = await mockedDB.run(contextForLoadDB)
      expect(ret.context.db).toBeDefined()
    })

    it('provide an undefined provider object', async () => {
      const defaultProvider = contextForLoadDB.provider
      const db = new LoadDatabase(contextForLoadDB)
      contextForLoadDB.provider = undefined
      await expect(db.run(contextForLoadDB)).rejects.toThrow(
        'Provider is not connected',
      )
      // recover provider object
      contextForLoadDB.provider = defaultProvider
    })
  })

  describe('LoadHDWallet', () => {
    let contextForHDWallet
    let optionForHDWallet
    let defaultConfig

    beforeAll(async () => {
      optionForHDWallet = option
      defaultConfig = option.base
      const connection = new ConnectWeb3(optionForHDWallet)
      let ret = await connection.run(context)
      contextForHDWallet = ret.context
    })

    beforeEach(async () => {
      optionForHDWallet.base = defaultConfig
      let db = new LoadDatabase(optionForHDWallet)
      let ret = await db.run(contextForHDWallet)
      contextForHDWallet = ret.context
    })

    afterEach(async () => {
      if (fs.existsSync(SQLITE_DB_NAME)) {
        fs.unlinkSync(SQLITE_DB_NAME)
      }
    })

    it('get from seedKeystore provided by json file', async () => {
      const mockedHdWallet = mockLoadHDWallet(optionForHDWallet)
      mockedHdWallet.ask.mockResolvedValue({
        password: 'helloworld',
      })
      let ret = await mockedHdWallet.run(contextForHDWallet)

      const walletContext = ret.context
      expect(walletContext.isInitialSetup).toBe(false)
      expect(walletContext.accounts!.length).toBeGreaterThan(0)
      const walleAccounts = await walletContext.wallet!.retrieveAccounts()
      expect(walleAccounts[0].ethAccount.address).toEqual(
        walletContext.accounts![0].ethAccount.address,
      )

      const hdWallet = new HDWallet(walletContext.provider!, walletContext.db!)
      const wallets = await hdWallet.list()
      expect(wallets.length).toEqual(1)
    })

    it('get an existing wallet in DB', async () => {
      // create a wallet in db first
      const mockedHdWallet = mockLoadHDWallet(optionForHDWallet)
      mockedHdWallet.ask.mockResolvedValue({
        password: 'helloworld',
      })
      let ret = await mockedHdWallet.run(contextForHDWallet)
      let walletContext = ret.context
      const numOfAccounts = walletContext.accounts!.length
      const zkAccount = walletContext.accounts![0]

      // new a LoadHDWallet instance and wallets inside should be from DB
      let configWithoutKeystore = loadConfig(WALLET_CONFIG_ONLY_PROVIDER)
      optionForHDWallet.base = configWithoutKeystore
      const hdWallet = mockLoadHDWallet(optionForHDWallet)
      hdWallet.ask.mockResolvedValue({
        password: 'helloworld',
      })
      ret = await hdWallet.run(walletContext)
      walletContext = ret.context

      const wallets = await walletContext.wallet!.list()
      expect(wallets.length).toEqual(1)
      expect(walletContext.isInitialSetup).toBe(false)
      expect(walletContext.accounts!.length).toEqual(numOfAccounts)
      expect(walletContext.accounts![0].ethAddress).toEqual(
        zkAccount.ethAddress,
      )
    })

    it('select from existing wallets in DB', async () => {
      const defaultConfig = optionForHDWallet.base

      // create a wallet with type of EncryptedWallet in db first
      let configWithoutKeystore = loadConfig(WALLET_CONFIG_ONLY_PROVIDER)
      configWithoutKeystore.mnemonic = MNEMONIC
      optionForHDWallet.base = configWithoutKeystore
      let mockedHdWallet = mockLoadHDWallet(optionForHDWallet)
      mockedHdWallet.ask.mockResolvedValue({
        password: 'helloworld',
        retyped: 'helloworld',
      })
      let ret = await mockedHdWallet.run(contextForHDWallet)
      // let walletContext = ret.context

      // create 2nd wallet through keystore
      optionForHDWallet.base = defaultConfig
      mockedHdWallet = mockLoadHDWallet(optionForHDWallet)
      mockedHdWallet.ask.mockResolvedValue({
        password: 'helloworld',
      })
      ret = await mockedHdWallet.run(ret.context)
      let secondWalletContext = ret.context
      // walletContext = ret.context

      // select the 2nd wallet
      optionForHDWallet.base = configWithoutKeystore
      const hdWallet = mockLoadHDWallet(optionForHDWallet)
      hdWallet.ask.mockResolvedValue({
        idx: 1,
        password: 'helloworld',
      })
      ret = await hdWallet.run(ret.context)
      let walletContext = ret.context

      const wallets = await walletContext.wallet!.list()
      expect(wallets.length).toEqual(2)
      expect(walletContext.accounts!.length).toEqual(1)

      // make sure returned `accounts` is equivalent to `wallet`
      // const accountFrom2ndWallet = await secondHDWallet.retrieveAccounts()
      expect(walletContext.accounts![0].ethAddress).toEqual(
        secondWalletContext.accounts![0].ethAddress,
      )
    })

    it('create a new wallet', async () => {
      const configWithoutKeystore = loadConfig(WALLET_CONFIG_ONLY_PROVIDER)
      optionForHDWallet.base = configWithoutKeystore
      const mockedHdWallet = mockLoadHDWallet(optionForHDWallet)
      mockedHdWallet.ask.mockResolvedValue({
        create: 1,
        language: 8,
        length: 12,
        proceed: true,
        password: 'helloworld',
        retyped: 'helloworld',
      })
      let ret = await mockedHdWallet.run(contextForHDWallet)

      const walletContext = ret.context
      expect(walletContext.isInitialSetup).toBe(true)
      expect(walletContext.accounts!.length).toBeGreaterThan(0)
      const walleAccounts = await walletContext.wallet!.retrieveAccounts()
      expect(walleAccounts[0].ethAccount.address).toEqual(
        walletContext.accounts![0].ethAccount.address,
      )
      const hdWallet = new HDWallet(walletContext.provider!, walletContext.db!)
      const wallets = await hdWallet.list()
      expect(wallets.length).toEqual(1)
    })

    it('create a new wallet from input mnemonic', async () => {
      let configWithoutKeystore = loadConfig(WALLET_CONFIG_ONLY_PROVIDER)
      configWithoutKeystore.mnemonic = MNEMONIC
      optionForHDWallet.base = configWithoutKeystore
      const mockedHdWallet = mockLoadHDWallet(optionForHDWallet)
      mockedHdWallet.ask.mockResolvedValue({
        password: 'helloworld',
        retyped: 'helloworld',
      })
      let ret = await mockedHdWallet.run(contextForHDWallet)

      const walletContext = ret.context
      expect(walletContext.isInitialSetup).toBe(true)
      expect(walletContext.accounts![0].ethAccount.address).toEqual(
        ACCOUNT0_ADDR,
      )

      const hdWallet = new HDWallet(walletContext.provider!, walletContext.db!)
      const wallets = await hdWallet.list()
      expect(wallets.length).toEqual(1)
    })

    it('abort while creating a new wallet', async () => {
      const configWithoutKeystore = loadConfig(WALLET_CONFIG_ONLY_PROVIDER)
      optionForHDWallet.base = configWithoutKeystore
      const mockedHdWallet = mockLoadHDWallet(optionForHDWallet)
      mockedHdWallet.ask.mockResolvedValue({
        create: 1,
        language: 8,
        length: 12,
        proceed: false,
      })
      let ret = await mockedHdWallet.run(contextForHDWallet)

      const walletContext = ret.context
      expect(ret.next).toEqual(Menu.EXIT)
      expect(walletContext.isInitialSetup).toBeUndefined()
      expect(walletContext.accounts).toBeUndefined()
    })

    it('provide an undefined db object', async () => {
      const defaultDB = contextForHDWallet.db
      const mockedHdWallet = mockLoadHDWallet(optionForHDWallet)
      contextForHDWallet.db = undefined
      await expect(mockedHdWallet.run(contextForHDWallet)).rejects.toThrow(
        'Database is not loaded',
      )
      // recover db object
      contextForHDWallet.db = defaultDB
    })
    it('provide an undefined provider object', async () => {
      const defaultProvider = contextForHDWallet.provider
      const mockedHdWallet = mockLoadHDWallet(optionForHDWallet)
      contextForHDWallet.provider = undefined
      await expect(mockedHdWallet.run(contextForHDWallet)).rejects.toThrow(
        'Provider is not connected',
      )
      // recover provider object
      contextForHDWallet.provider = defaultProvider
    })

    // TODO: unable to test `create=0` bcs unable to mock `word` with different output
    it.skip('import mnemonic', async () => {
      // mockedHdWallet.ask.mockResolvedValue({
      //   create: 0,
      //   language: 8,
      //   length: 12,
      //   proceed: true,
      //   password: 'helloworld',
      //   retyped: 'helloworld',
      // })
      // need to return repeatedly, but no idea how to do now
      // mockedHdWallet.ask.mockResolvedValue({"word": "create"})
    })
  })

  describe('TrackingAccount', () => {
    let contextForTA

    beforeAll(async () => {
      const connection = new ConnectWeb3(option)
      let ret = await connection.run(context)
      contextForTA = ret.context
    })

    beforeEach(async () => {
      let db = new LoadDatabase(option)
      const ret = await db.run(contextForTA)
      contextForTA = ret.context
    })

    afterEach(async () => {
      if (fs.existsSync(SQLITE_DB_NAME)) {
        fs.unlinkSync(SQLITE_DB_NAME)
      }
    })

    it('select existing accounts', async () => {
      const defaultConfig = option.base

      // create a new account in LoadHDWallet to make `isInitialSetup == true`
      let configWithoutKeystore = loadConfig(WALLET_CONFIG_ONLY_PROVIDER)
      configWithoutKeystore.mnemonic = MNEMONIC
      option.base = configWithoutKeystore
      const mockedHdWallet = mockLoadHDWallet(option)
      mockedHdWallet.ask.mockResolvedValue({
        password: 'helloworld',
        retyped: 'helloworld',
      })
      let ret = await mockedHdWallet.run(contextForTA)
      const contextForNewAccount = ret.context
      const accounts = await contextForNewAccount.wallet!.retrieveAccounts()

      const mockedAccount = mockTrackingAccount(option)
      mockedAccount.ask.mockResolvedValue({ idx: 1 }) // 1: jump to next step
      ret = await mockedAccount.run(contextForNewAccount)

      expect(ret.next).toEqual(Menu.LOAD_NODE)
      expect(ret.context.accounts![0].ethAddress).toEqual(
        accounts[0].ethAddress,
      )

      // recovery
      option.base = defaultConfig
    })

    it('select unsupported idx', async () => {
      const defaultConfig = option.base

      // create a new account in LoadHDWallet to make `isInitialSetup == true`
      let configWithoutKeystore = loadConfig(WALLET_CONFIG_ONLY_PROVIDER)
      configWithoutKeystore.mnemonic = MNEMONIC
      option.base = configWithoutKeystore
      const mockedHdWallet = mockLoadHDWallet(option)
      mockedHdWallet.ask.mockResolvedValue({
        password: 'helloworld',
        retyped: 'helloworld',
      })
      let ret = await mockedHdWallet.run(contextForTA)
      const contextForNewAccount = ret.context
      const accounts = await contextForNewAccount.wallet!.retrieveAccounts()

      const mockedAccount = mockTrackingAccount(option)
      mockedAccount.ask.mockResolvedValue({ idx: 2 }) // only 0 and 1 are defined
      ret = await mockedAccount.run(contextForNewAccount)

      expect(ret.next).toEqual(Menu.EXIT)
      expect(ret.context.accounts![0].ethAddress).toEqual(
        accounts[0].ethAddress,
      )

      // recovery
      option.base = defaultConfig
    })

    it('get accounts created in loadHDWallet (isInitialSetup == false)', async () => {
      let mockedHdWallet = mockLoadHDWallet(option)
      mockedHdWallet.ask.mockResolvedValue({
        password: 'helloworld',
      })
      let ret = await mockedHdWallet.run(contextForTA)
      const accountContext = ret.context
      const accounts = await accountContext.wallet!.retrieveAccounts()

      const account = new TrackingAccount(option)
      ret = await account.run(accountContext)

      expect(ret.next).toEqual(Menu.LOAD_NODE)
      expect(ret.context.accounts![0].ethAddress).toEqual(
        accounts[0].ethAddress,
      )
    })

    it('get accounts from previous history (numberOfAccounts != 0)', async () => {
      let mockedHdWallet = mockLoadHDWallet(option)
      mockedHdWallet.ask.mockResolvedValue({
        password: 'helloworld',
      })
      let ret = await mockedHdWallet.run(contextForTA)
      const accountContext = ret.context
      const accounts = await accountContext.wallet!.retrieveAccounts()

      option.base.numberOfAccounts = 2
      const account = new TrackingAccount(option)
      ret = await account.run(accountContext)

      expect(ret.next).toEqual(Menu.LOAD_NODE)
      expect(ret.context.accounts![0].ethAddress).toEqual(
        accounts[0].ethAddress,
      )
    })

    it('provide an undefined wallet obj', async () => {
      const account = new TrackingAccount(option)
      await expect(account.run(contextForTA)).rejects.toThrow(
        'Wallet is not loaded',
      )
    })

    // TODO: unable to test if having any re-run cases for now
    it.skip('create a new account', async () => {
      // const defaultConfig = option.base
      // // create a new account in LoadHDWallet to make `isInitialSetup == true`
      // let configWithoutKeystore = loadConfig(WALLET_CONFIG_ONLY_PROVIDER)
      // configWithoutKeystore.mnemonic = MNEMONIC
      // option.base = configWithoutKeystore
      // const mockedHdWallet = mockLoadHDWallet(option)
      // mockedHdWallet.ask.mockResolvedValue({
      //   password: 'helloworld',
      //   retyped: 'helloworld',
      // })
      // let ret = await mockedHdWallet.run(contextForTA)
      // const contextForNewAccount = ret.context
      // const accounts = await contextForNewAccount.wallet!.retrieveAccounts()
      // const mockedAccount = mockTrackingAccount(option)
      // // mockedAccount.ask.mockResolvedValue({ idx: 0 }) // 0: create a new account
      // ret = await mockedAccount.run(contextForNewAccount)
    })
  })

  describe('LoadNode', () => {
    let contextForLoadNode

    beforeAll(async () => {
      const connection = new ConnectWeb3(option)
      let ret = await connection.run(context)
      let db = new LoadDatabase(option)
      ret = await db.run(ret.context)
      let mockedHdWallet = mockLoadHDWallet(option)
      mockedHdWallet.ask.mockResolvedValue({
        password: 'helloworld',
      })
      ret = await mockedHdWallet.run(ret.context)
      const account = new TrackingAccount(option)
      ret = await account.run(ret.context)
      contextForLoadNode = ret.context
    })

    it('run a full node', async () => {
      // option.base.fullnode = true
      const node = new LoadNode(option)
      const ret = await node.run(contextForLoadNode)

      expect(ret.next).toEqual(Menu.SAVE_CONFIG)
      expect(ret.context.node).toBeDefined()
      expect(ret.context.node!.isRunning()).toEqual(false)
      expect(ret.context.node!.layer2.config.address).toEqual(
        option.base.address,
      )
      expect(ret.context.node!.bootstrapHelper).toBeUndefined()
    })

    // FIXME: need to launch coordinator
    it.skip('run a light node', async () => {
      option.base.fullnode = false
      const node = new LoadNode(option)
      const ret = await node.run(contextForLoadNode)

      expect(ret.next).toEqual(Menu.SAVE_CONFIG)
      expect(ret.context.node).toBeDefined()
      expect(ret.context.node!.isRunning()).toEqual(false)
      expect(ret.context.node!.bootstrapHelper).toBeDefined()
    })

    it('provide an undefined provider obj', async () => {
      const defaultProvider = contextForLoadNode.provider
      contextForLoadNode.provider = undefined
      const node = new LoadNode(option)
      await expect(node.run(contextForLoadNode)).rejects.toThrow(
        'Websocket provider does not exist',
      )

      // recovery
      contextForLoadNode.provider = defaultProvider
    })

    it('provide an undefined db obj', async () => {
      const defaultDB = contextForLoadNode.db
      contextForLoadNode.db = undefined
      const node = new LoadNode(option)
      await expect(node.run(contextForLoadNode)).rejects.toThrow(
        'Database does not exist',
      )

      // recovery
      contextForLoadNode.db = defaultDB
    })

    it('provide an undefined wallet obj', async () => {
      const defaultAccounts = contextForLoadNode.accounts
      contextForLoadNode.accounts = undefined
      const node = new LoadNode(option)
      await expect(node.run(contextForLoadNode)).rejects.toThrow(
        'Wallet is not set',
      )

      // recovery
      contextForLoadNode.accounts = defaultAccounts
    })
  })

  describe('SaveConfig', () => {
    let contextForConfig

    beforeAll(async () => {
      const connection = new ConnectWeb3(option)
      let ret = await connection.run(context)
      let db = new LoadDatabase(option)
      ret = await db.run(ret.context)
      let mockedHdWallet = mockLoadHDWallet(option)
      mockedHdWallet.ask.mockResolvedValue({
        password: 'helloworld',
      })
      ret = await mockedHdWallet.run(ret.context)
      const account = new TrackingAccount(option)
      ret = await account.run(ret.context)
      const node = new LoadNode(option)
      ret = await node.run(ret.context)
      contextForConfig = ret.context
    })

    it('return directly if not a new create wallet', async () => {
      const config = new SaveConfig(option)
      const ret = await config.run(contextForConfig)
      expect(ret.next).toEqual(Menu.COMPLETE)
    })

    it('save a newly config', async () => {
      contextForConfig.isInitialSetup = true
      const mockedConfig = mockSaveConfig(option)
      mockedConfig.ask.mockResolvedValue({
        save: true,
        password: 'helloworld',
        filePath: NEW_WALLET_CONFIG_PATH,
        // overwrite: false,
      })
      const ret = await mockedConfig.run(contextForConfig)

      expect(ret.next).toEqual(Menu.COMPLETE)
      expect(fs.existsSync(NEW_WALLET_CONFIG_PATH)).toBe(true)
    })

    it('save config with overwriting existing one', async () => {
      fs.writeFileSync(NEW_WALLET_CONFIG_PATH, JSON.stringify(option.base))
      expect(fs.existsSync(NEW_WALLET_CONFIG_PATH)).toBe(true)

      contextForConfig.isInitialSetup = true
      const mockedConfig = mockSaveConfig(option)
      mockedConfig.ask.mockResolvedValue({
        save: true,
        password: 'helloworld',
        filePath: NEW_WALLET_CONFIG_PATH,
        overwrite: true,
      })
      const ret = await mockedConfig.run(contextForConfig)

      expect(ret.next).toEqual(Menu.COMPLETE)
      expect(fs.existsSync(NEW_WALLET_CONFIG_PATH)).toBe(true)
      const newConfig = loadConfig(NEW_WALLET_CONFIG_PATH)
      expect(newConfig['accountNumber']).toEqual(ret.context.accounts!.length)
    })

    it('not saving config', async () => {
      contextForConfig.isInitialSetup = true
      const mockedConfig = mockSaveConfig(option)
      mockedConfig.ask.mockResolvedValue({
        save: false,
      })
      const ret = await mockedConfig.run(contextForConfig)

      expect(ret.next).toEqual(Menu.COMPLETE)
      expect(fs.existsSync(NEW_WALLET_CONFIG_PATH)).toBe(false)
    })

    it('provide an undefined wallet obj', async () => {
      contextForConfig.isInitialSetup = true
      const defaultWallet = contextForConfig.wallet
      contextForConfig.wallet = undefined
      const mockedConfig = mockSaveConfig(option)
      mockedConfig.ask.mockResolvedValue({
        save: true,
      })
      await expect(mockedConfig.run(contextForConfig)).rejects.toThrow(
        'Wallet is not configured',
      )

      // recovery
      contextForConfig.accounts = defaultWallet
    })
  })
})
