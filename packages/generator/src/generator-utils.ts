/* eslint-disable no-case-declarations */
import fs from 'fs'
import util from 'util'
import Web3 from 'web3'
import prettier from 'pino-pretty'
import { Transform } from 'stream'
import { networkInterfaces } from 'os'

import { F, Fp, Point } from '@zkopru/babyjubjub'
import {
  Note,
  Utxo,
  RawTx,
  ZkTx,
  UtxoStatus,
  ZkAddress,
} from '@zkopru/transaction'
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
  const writeStream = fs.createWriteStream(`./${fileName}`)
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

/* eslint-disable @typescript-eslint/no-use-before-define */
export function getTx(rawTx) {
  if (rawTx === undefined) {
    throw Error(`rawTx is undefined, please check queue data`)
  }
  const owner = ZkAddress.from(
    Fp.from(rawTx.inflow[0].owner.PubSK),
    Point.from(rawTx.inflow[0].owner.N.x, rawTx.inflow[0].owner.N.y),
  )

  const tx: RawTx = {
    inflow: rawTx.inflow.map(flow => {
      return new Utxo(
        owner,
        Fp.from(flow.salt),
        {
          eth: Fp.from(flow.asset.eth),
          tokenAddr: Fp.from(flow.asset.tokenAddr),
          erc20Amount: Fp.from(flow.asset.erc20Amount),
          nft: Fp.from(flow.asset.nft),
        },
        flow.status,
      )
    }),
    outflow: rawTx.outflow.map(flow => {
      return new Utxo(
        owner,
        Fp.from(flow.salt),
        {
          eth: Fp.from(flow.asset.eth),
          tokenAddr: Fp.from(flow.asset.tokenAddr),
          erc20Amount: Fp.from(flow.asset.erc20Amount),
          nft: Fp.from(flow.asset.nft),
        },
        flow.status,
      )
    }),
    fee: Fp.from(rawTx.fee),
  }
  return tx
}

export function getZkTx(tx) {
  /* eslint-disable @typescript-eslint/camelcase */
  const zktx = new ZkTx({
    inflow: tx.inflow.map(({ nullifier, root }) => ({
      nullifier: Fp.from(nullifier),
      root: Fp.from(root),
    })),
    outflow: tx.outflow.map(({ note, outflowType, data }) => ({
      note: Fp.from(note),
      outflowType: Fp.from(outflowType),
      data: data ? Fp.from(data) : undefined,
    })),
    fee: Fp.from(tx.fee),
    proof: {
      pi_a: tx.proof.pi_a.map((v: string) => Fp.from(v)),
      pi_b: tx.proof.pi_b.map((a: string[]) =>
        a.map((v: string) => Fp.from(v)),
      ),
      pi_c: tx.proof.pi_c.map((v: string) => Fp.from(v)),
    },
    swap: tx.swap ? Fp.from(tx.swap) : undefined,
    memo: tx.memo
      ? {
          version: tx.memo.version,
          data: Buffer.from(tx.memo.data, 'base64'),
        }
      : undefined,
  })
  /* eslint-enable @typescript-eslint/camelcase */
  return zktx
}
