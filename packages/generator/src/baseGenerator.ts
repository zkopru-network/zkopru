/* eslint-disable no-case-declarations */
import fs from 'fs'
import util from 'util'
import Web3 from 'web3'
import prettier from 'pino-pretty'
import { Transform } from 'stream'
import { networkInterfaces } from 'os'

import { F } from '@zkopru/babyjubjub'
import { Note, UtxoStatus } from '@zkopru/transaction'
import { HDWallet, ZkAccount } from '@zkopru/account'
import { logStream } from '@zkopru/utils'
import { SQLiteConnector, schema } from '@zkopru/database/dist/node'
import { ZkWallet } from '~zk-wizard/zk-wallet'

// helper functions
export async function getBase(url: string, mnemonic: string, password: string) {
  const webSocketProvider = new Web3.providers.WebsocketProvider(url, {
    reconnect: { auto: true },
  })

  // callback function for ws connection
  async function awaitConnection() {
    return new Promise<void>(res => {
      if (webSocketProvider.connected) return res()
      webSocketProvider.on('connect', res)
    })
  }

  webSocketProvider.connect() // send connection to Layer1
  await awaitConnection()

  // Create Wallet
  const mockupDB = await SQLiteConnector.create(schema, ':memory:')
  const web3 = new Web3(webSocketProvider)
  const hdWallet = new HDWallet(web3, mockupDB)

  await hdWallet.init(mnemonic, password) //

  return { hdWallet, mockupDB, webSocketProvider }
}

export async function getDepositTx(wallet, note: Note, fee: F) {
  // TODO: set Type
  const { deposit } = wallet.node.layer1.user.methods
  const tx = deposit(
    note.owner.spendingPubKey().toString(),
    note.salt.toUint256().toString(),
    note
      .eth()
      .toUint256()
      .toString(),
    note
      .tokenAddr()
      .toAddress()
      .toString(),
    note
      .erc20Amount()
      .toUint256()
      .toString(),
    note
      .nft()
      .toUint256()
      .toString(),
    fee.toString(),
  )
  return tx
}

export function logAll(Object) {
  return util.inspect(Object, {
    showHidden: true,
    depth: null,
  })
}

export function startLogger(fileName: string) {
  const writeStream = fs.createWriteStream(`/${fileName}`)
  logStream.addStream(writeStream)
  const pretty = prettier({
    translateTime: false,
    colorize: true,
  })
  const prettyStream = new Transform({
    transform: (chunk, _, cb) => {
      cb(null, pretty(JSON.parse(chunk.toString())))
    },
  })
  prettyStream.pipe(process.stdout)
  logStream.addStream(prettyStream)
}

// TODO: get fency current Coodinator Ip
export function getLocalIP() {
  const nets = networkInterfaces()
  const net = nets.eth0
  let result = ''

  if (net) {
    result = net[0]?.address
  } else {
    throw new Error(`eth0 does not detected`)
  }
  return result
}

// TODO: create get only UserNote
export async function getEthUtxo(wallet: ZkWallet, account: ZkAccount) {
  const unSpentUtxo = await wallet.db.findMany('Utxo', {
    where: {
      owner: [account.zkAddress.toString()],
      status: UtxoStatus.UNSPENT,
      usedAt: null,
    },
  })
  return unSpentUtxo
}
