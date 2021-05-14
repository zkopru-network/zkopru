/* eslint-disable no-case-declarations */
import util from 'util'
import Web3 from 'web3'
import { networkInterfaces } from 'os'

import { F } from '@zkopru/babyjubjub'
import { Note } from '@zkopru/transaction'
import { ZkAccount, HDWallet } from '@zkopru/account'
import { SQLiteConnector, schema } from '@zkopru/database/dist/node'

// helper functions
export async function getProviders(
  url: string,
  mnemonic: string,
  password: string,
) {
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
  const mockup = await SQLiteConnector.create(schema, ':memory:')
  const web3 = new Web3(webSocketProvider)
  const hdWallet = new HDWallet(web3, mockup)

  await hdWallet.init(mnemonic, password) //

  return { hdWallet, webSocketProvider }
}

export async function genAccounts(hdWallet: HDWallet, num: number) {
  const accounts: ZkAccount[] = []

  for (let i = 0; i < num; i++) {
    const account = await hdWallet.createAccount(i)
    accounts.push(account)
  }
  return accounts
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
