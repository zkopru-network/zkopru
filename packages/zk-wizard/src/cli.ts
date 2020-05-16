#!/usr/bin/env node

/* eslint-disable no-case-declarations */
import prompts from 'prompts'
import yargs from 'yargs'
import chalk from 'chalk'
import path from 'path'
import fs from 'fs-extra'
import { LevelDB } from '@nano-sql/adapter-leveldb'
import { InanoSQLInstance } from '@nano-sql/core/lib/interfaces'
import { HDWalletSql } from '@zkopru/database'
import { ZkAccount, HDWallet } from '@zkopru/account'
import { ZkOPRUNode } from '@zkopru/core'
import Web3 from 'web3'
import { validateMnemonic, wordlists } from 'bip39'
import { ZkWizard } from './zk-wizard'
import { getWeb3, downloadKeys as getKeys, initDB } from './utils'

export interface Argument {
  [x: string]: unknown
  f: boolean | undefined
}

const print = (chalk?: (...text: string[]) => string) => (
  ...str: unknown[]
) => {
  if (chalk) {
    console.log(chalk(...(str as string[])))
  } else {
    console.log(...str)
  }
}

const { argv } = yargs
  .scriptName('zk-wizard')
  .usage('$0 <command> [args]')
  .options({
    f: {
      type: 'boolean',
      default: false,
      alias: 'fullnode',
      describe: 'Run a full-node zkopru wallet',
    },
    d: {
      type: 'boolean',
      default: false,
      alias: 'develop',
      describe: 'Run a develop version',
    },
    n: {
      type: 'number',
      alias: 'networkId',
      default: 1,
    },
    c: {
      type: 'number',
      alias: 'chainId',
      default: 1,
    },
    a: {
      type: 'string',
      alias: 'address',
      default: '0x7C728214be9A0049e6a86f2137ec61030D0AA964',
    },
    b: {
      type: 'string',
      alias: 'bootstrap',
      default: 'https://bootstrap.zkopru.network',
    },
    ws: {
      type: 'string',
      alias: 'websocket',
      default: 'ws://ws.zkopru.network',
    },
    keys: {
      type: 'string',
      default: 'keys',
      describe: 'Path to store SNARK keys',
    },
    db: {
      type: 'string',
      default: 'db',
      alias: 'dbPath',
    },
    mnemonic: {
      type: 'string',
      default: undefined,
    },
  })
  .help()

print()('ARGVs', argv)

enum AppState {
  START,
  WEB3_CONNECTED,
  KEY_DOWNLOADED,
  DB_LOADED,
  SHOW_ACCOUNTS,
  SHOW_UTXOS,
  LOAD_NODE,
  SHOW_TOP_MENU,
  NODE_LOADED,
  READY,
  BUILDING,
  QUIT,
}

interface CliAppContext {
  zkopruId?: string
  web3?: Web3
  db?: InanoSQLInstance
  wallet?: HDWallet
  account?: ZkAccount
  node?: ZkOPRUNode
  state: AppState
  wizard?: ZkWizard
  keyPath?: string
}

const app: CliAppContext = {
  state: AppState.START,
}

const terminate = async () => {
  print()('Terminating...')
  process.exit()
}
async function ask<T extends string = string>(
  questions: prompts.PromptObject<T> | Array<prompts.PromptObject<T>>,
): Promise<prompts.Answers<T>> {
  const option: prompts.Options = {
    onCancel: async () => {
      await terminate()
    },
  }
  const answer = await prompts(questions, option)
  return answer
}

function setState(newState: AppState) {
  app.state = newState
}

const connectWeb3 = async () => {
  print(chalk.blue)('Connecting to the Ethereum network')
  app.web3 = await getWeb3(argv.ws)
  print(chalk.blue)(`Connected via ${argv.ws}`)
  setState(AppState.WEB3_CONNECTED)
}

const downloadKeys = async () => {
  const pwd = path.join(process.cwd(), argv.keys)
  if (fs.existsSync(pwd)) {
    setState(AppState.KEY_DOWNLOADED)
  } else {
    fs.mkdirpSync(pwd)
    await getKeys('https://d2xnpw7ihgc4iv.cloudfront.net/keys.tgz', pwd)
      .then(() => {
        print(chalk.green)('Download completed')
        setState(AppState.KEY_DOWNLOADED)
      })
      .catch(err => {
        print(chalk.red)('Download failed', err)
        setState(AppState.QUIT)
      })
  }
}

const loadDatabase = async () => {
  if (!app.web3) {
    throw Error(chalk.red('Web3 does not exist'))
  }
  fs.mkdirpSync(argv.db)
  const { zkopruId, db } = await initDB({
    name: 'zkopru-cli-wallet',
    dbAdapter: new LevelDB(argv.db),
    web3: app.web3,
    address: argv.a,
  })
  app.db = db
  app.zkopruId = zkopruId
  setState(AppState.DB_LOADED)
}

const prepareAccount = async () => {
  if (!app.db) {
    throw Error(chalk.red('Database is not loaded'))
  }
  if (!app.web3) {
    throw Error(chalk.red('Web3 is not loaded'))
  }
  const wallet = new HDWallet(app.web3, app.db)
  const existingWallets = await wallet.list()
  if (existingWallets.length === 0) {
    let mnemonic: string
    if (argv.mnemonic) {
      print()('Using imported mnemonic words')
      mnemonic = argv.mnemonic || ''
    } else {
      const { create } = await ask({
        type: 'select',
        name: 'create',
        message: 'You should import mnemonic keys or create new one.',
        choices: [
          { title: 'create', value: true },
          { title: 'import', value: false },
        ],
      })
      const { language } = await ask({
        type: 'select',
        name: 'language',
        message: 'Which language do you want to use for your mnemonic words?',
        choices: Object.keys(wordlists).map(lan => ({
          title: lan,
          value: lan,
        })),
      })
      const { length } = await ask({
        type: 'select',
        name: 'length',
        message: 'Choose your mnemonic strength',
        choices: [
          {
            title: '12',
            value: 12,
          },
          {
            title: '24',
            value: 24,
          },
        ],
      })
      const strength = length === 12 ? 128 : 256
      const wordList = wordlists[language]
      if (create) {
        mnemonic = HDWallet.newMnemonic(strength, wordList)
        print()('MNEMONIC: ', mnemonic)
        const { proceed } = await ask({
          type: 'confirm',
          name: 'proceed',
          message:
            'You should write down this mnemonic words on your note. Proceed?',
        })
        if (!proceed) {
          setState(AppState.QUIT)
          return
        }
      } else {
        const words: string[] = []
        print()('Please type mnemonic words sequentially.')
        while (words.length !== length) {
          const { word } = await ask({
            type: 'text',
            name: 'word',
            message: `Type a mnemonic word for index ${words.length}.`,
          })
          if (wordList.includes(word)) {
            words.push(word)
          } else {
            print()('Invalid mnemonic word. Try again.')
          }
        }
        mnemonic = words.join(' ')
        if (validateMnemonic(mnemonic)) {
          print(chalk.green)('Great! Imported mnemonic keys successfully.')
        } else {
          console.error('Imported mnemonic is not valid.')
          await prepareAccount()
          return
        }
      }
      const { password } = await ask({
        type: 'password',
        name: 'password',
        message: 'Type password',
      })
      print()('password is', password)
      await wallet.init(mnemonic, password)
    }
  } else {
    let existing!: HDWalletSql
    if (existingWallets.length === 1) {
      existing = existingWallets[0] as HDWalletSql
    } else if (existingWallets.length > 1) {
      const { idx } = await ask({
        type: 'select',
        name: 'idx',
        message: 'Which wallet do you want to use?',
        choices: existingWallets.map((obj, i) => ({
          title: obj.id || '',
          value: i,
        })),
      })
      if (idx < 0 || idx >= existingWallets.length) {
        print(chalk.red)(
          `You should select between 0 - ${existingWallets.length - 1}`,
        )
        await prepareAccount()
        return
      }
      existing = existingWallets[idx]
    }
    const { password } = await ask({
      type: 'password',
      name: 'password',
      message: 'Type password',
    })
    try {
      print()('loading password is', password)
      await wallet.load(existing, password)
    } catch (err) {
      console.error(err)
      print()('Failed to load wallet. Try again')
      await prepareAccount()
    }
  }
  let accounts: ZkAccount[] = await wallet.retrieveAccounts()
  if (accounts.length === 0) {
    const account = await wallet.createAccount(0)
    accounts = [account]
  }
  app.wallet = wallet
  setState(AppState.LOAD_NODE)
}

const menuAccount = async () => {
  if (!app.wallet) {
    throw Error(chalk.red('Wallet is not loaded'))
  }
  const accounts: ZkAccount[] = await app.wallet.retrieveAccounts()
  const { idx } = await ask({
    type: 'select',
    name: 'idx',
    message: 'Which account do you want to use?',
    choices: [
      ...accounts.map((obj, i) => ({
        title: obj.address,
        value: i,
      })),
      {
        title: 'create new one',
        value: -1,
      },
      {
        title: 'quit',
        value: -2,
      },
    ],
  })
  switch (idx) {
    case -1:
      await app.wallet.createAccount(accounts.length)
      await menuAccount()
      break
    case -2:
      setState(AppState.QUIT)
      break
    default:
      app.account = accounts[idx]
      setState(AppState.LOAD_NODE)
  }
}

const menuUtxos = async () => {
  if (!app.wallet) {
    throw Error(chalk.red('Wallet is not loaded'))
  }
  const accounts: ZkAccount[] = await app.wallet.retrieveAccounts()
  const { idx } = await ask({
    type: 'select',
    name: 'idx',
    message: 'Which account do you want to use?',
    choices: [
      ...accounts.map((obj, i) => ({
        title: obj.address,
        value: i,
      })),
      {
        title: 'create new one',
        value: -1,
      },
      {
        title: 'quit',
        value: -2,
      },
    ],
  })
  switch (idx) {
    case -1:
      await app.wallet.createAccount(accounts.length)
      await menuAccount()
      break
    case -2:
      setState(AppState.QUIT)
      break
    default:
      app.account = accounts[idx]
      setState(AppState.LOAD_NODE)
  }
}

const loadZkOPRUNode = async () => {
  print(chalk.blue)('Synchronizing ZKOPRU node')
  setState(AppState.SHOW_ACCOUNTS)
}

const showTopMenus = async () => {
  const { choice } = await ask({
    type: 'select',
    name: 'choice',
    message: 'Select menu',
    choices: [
      { title: 'menu 0', value: 0 },
      { title: 'menu 1', value: 1 },
      { title: 'menu 2', value: 2 },
      { title: 'quit', value: 3 },
    ],
  })
  if (choice === 3) setState(AppState.QUIT)
}

const main = async () => {
  while (app.state !== AppState.QUIT) {
    switch (app.state) {
      case AppState.START:
        await connectWeb3()
        break
      case AppState.WEB3_CONNECTED:
        await downloadKeys()
        break
      case AppState.KEY_DOWNLOADED:
        await loadDatabase()
        break
      case AppState.DB_LOADED:
        await prepareAccount()
        break
      case AppState.LOAD_NODE:
        await loadZkOPRUNode()
        break
      case AppState.SHOW_ACCOUNTS:
        await menuAccount()
        break
      case AppState.SHOW_UTXOS:
        await menuUtxos()
        break
      case AppState.SHOW_TOP_MENU:
        await showTopMenus()
        break
      default:
        break
    }
  }
  await terminate()
}
;(async () => {
  await main()
})().catch(e => {
  console.error(e)
})
