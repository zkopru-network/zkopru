import ZkOPRUContract from '@zkopru/contracts'
import { L1Config, schema, ChainConfig } from '@zkopru/database'
import Web3 from 'web3'
import tar from 'tar'
import { InanoSQLInstance, nSQL } from '@nano-sql/core'
import { InanoSQLAdapter } from '@nano-sql/core/lib/interfaces'
import { ZkAccount } from '@zkopru/account'
import { Grove, poseidonHasher, keccakHasher } from '@zkopru/tree'
import { WebsocketProvider } from 'web3-core'
import { LevelDB } from '@nano-sql/adapter-leveldb'
import { FullNode, LightNode, HttpBootstrapHelper } from '@zkopru/core'
import { SingleBar } from 'cli-progress'
import { https } from 'follow-redirects'

export async function getConfig({
  address,
  web3,
}: {
  address: string
  web3: Web3
}): Promise<L1Config> {
  const contract = ZkOPRUContract.asZkOptimisticRollUp(web3, address)
  const config: L1Config = {
    utxoTreeDepth: 31,
    withdrawalTreeDepth: 31,
    nullifierTreeDepth: 254,
    challengePeriod: 604800,
    minimumStake: '32000000000000000000',
    referenceDepth: 128,
    maxUtxoPerTree: '2147483648',
    maxWithdrawalPerTree: '2147483648',
    utxoSubTreeDepth: 5,
    utxoSubTreeSize: 32,
    withdrawalSubTreeDepth: 5,
    withdrawalSubTreeSize: 32,
  }
  await Promise.all([
    async () => {
      config.utxoTreeDepth = parseInt(
        await contract.methods.UTXO_TREE_DEPTH().call(),
        10,
      )
    },
    async () => {
      config.withdrawalTreeDepth = parseInt(
        await contract.methods.WITHDRAWAL_TREE_DEPTH().call(),
        10,
      )
    },
    async () => {
      config.nullifierTreeDepth = parseInt(
        await contract.methods.NULLIFIER_TREE_DEPTH().call(),
        10,
      )
    },
    async () => {
      config.challengePeriod = parseInt(
        await contract.methods.CHALLENGE_PERIOD().call(),
        10,
      )
    },
    async () => {
      config.minimumStake = await contract.methods.MINIMUM_STAKE().call()
    },
    async () => {
      config.referenceDepth = parseInt(
        await contract.methods.REF_DEPTH().call(),
        10,
      )
    },
    async () => {
      config.maxUtxoPerTree = await contract.methods.MAX_UTXO_PER_TREE().call()
    },
    async () => {
      config.maxWithdrawalPerTree = await contract.methods
        .MAX_WITHDRAWAL_PER_TREE()
        .call()
    },
    async () => {
      config.utxoSubTreeDepth = parseInt(
        await contract.methods.UTXO_SUB_TREE_DEPTH().call(),
        10,
      )
    },
    async () => {
      config.utxoSubTreeSize = parseInt(
        await contract.methods.UTXO_SUB_TREE_SIZE().call(),
        10,
      )
    },
    async () => {
      config.withdrawalSubTreeDepth = parseInt(
        await contract.methods.WITHDRAWAL_SUB_TREE_DEPTH().call(),
        10,
      )
    },
    async () => {
      config.withdrawalSubTreeSize = parseInt(
        await contract.methods.WITHDRAWAL_SUB_TREE_SIZE().call(),
        10,
      )
    },
  ])
  return config
}

export async function initDB({
  name,
  dbAdapter,
  web3,
  address,
}: {
  name: string
  dbAdapter: string | InanoSQLAdapter
  web3: Web3
  address: string
}): Promise<{
  db: InanoSQLInstance
  zkopruId: string
}> {
  await nSQL().createDatabase({
    id: name,
    mode: dbAdapter,
    tables: [
      schema.chain,
      schema.hdWallet,
      schema.keystore,
      schema.block,
      schema.deposit,
      schema.massDeposit,
      schema.utxo,
      schema.withdrawal,
      schema.migration,
      schema.utxoTree,
      schema.withdrawalTree,
      schema.nullifiers,
      schema.nullifierTreeNode,
    ],
  })
  const db = nSQL().useDatabase(name)
  const networkId = await web3.eth.net.getId()
  const chainId = await web3.eth.getChainId()
  const queryResult = await db
    .selectTable(schema.chain.name)
    .presetQuery('read', {
      networkId,
      chainId,
      address,
    })
    .exec()
  let zkopruId: string
  if (queryResult.length === 0) {
    const config = await getConfig({ address, web3 })
    const createResult = (await db
      .selectTable(schema.chain.name)
      .presetQuery('create', {
        networkId,
        chainId,
        address,
        config,
      })
      .exec()) as ChainConfig[]
    zkopruId = createResult[0].id
  } else {
    zkopruId = queryResult[0].id
  }
  return {
    db,
    zkopruId,
  }
}

export async function initGrove({
  zkopruId,
  db,
  accounts,
  config,
  fullSync,
}: {
  zkopruId: string
  config: L1Config
  db: InanoSQLInstance
  accounts: ZkAccount[]
  fullSync: boolean
}): Promise<{
  grove: Grove
}> {
  const grove = new Grove(zkopruId, db, {
    utxoTreeDepth: config.utxoTreeDepth,
    withdrawalTreeDepth: config.withdrawalTreeDepth,
    nullifierTreeDepth: config.nullifierTreeDepth,
    utxoSubTreeSize: config.utxoSubTreeSize,
    withdrawalSubTreeSize: config.withdrawalSubTreeSize,
    utxoHasher: poseidonHasher(config.utxoTreeDepth),
    withdrawalHasher: keccakHasher(config.withdrawalTreeDepth),
    nullifierHasher: keccakHasher(config.nullifierTreeDepth),
    fullSync,
    forceUpdate: true,
    pubKeysToObserve: accounts.map(account => account.pubKey),
    addressesToObserve: accounts.map(account => account.address),
  })
  await grove.init()
  return { grove }
}

export async function getFullNode({
  provider,
  address,
  path,
  accounts,
}: {
  provider: WebsocketProvider
  address: string
  path: string
  accounts: ZkAccount[]
}): Promise<FullNode> {
  const web3 = new Web3(provider)
  const dbAdapter = new LevelDB(path)
  const { db } = await initDB({
    name: `fullnode-db-${address}`,
    dbAdapter,
    web3,
    address,
  })
  const fullNode = await FullNode.new({
    provider,
    address,
    db,
    accounts,
  })
  return fullNode
}

export async function getLightNode({
  provider,
  address,
  path,
  bootstrapUrl,
  accounts,
}: {
  provider: WebsocketProvider
  address: string
  path: string
  bootstrapUrl: string
  accounts: ZkAccount[]
}): Promise<FullNode> {
  const web3 = new Web3(provider)
  const dbAdapter = new LevelDB(path)
  const { db } = await initDB({
    name: `lightnode-db-${address}`,
    dbAdapter,
    web3,
    address,
  })
  const lightNode = await LightNode.new({
    provider,
    address,
    db,
    accounts,
    bootstrapHelper: new HttpBootstrapHelper(bootstrapUrl),
    option: {
      header: true,
      deposit: true,
      migration: true,
      outputRollUp: true,
      withdrawalRollUp: true,
      nullifierRollUp: false, // Only for FULL NODE
      snark: false,
    },
  })
  return lightNode
}

export const downloadKeys = async (url: string, path: string) => {
  return new Promise((resolve, reject) => {
    const bar = new SingleBar({
      format: `Downloading snark keys | [{bar}] | {percentage}% | {value}/{total} KiB | ETA: {eta}s`,
    })
    let fileLength = 0
    let downloaded = 0
    https.get(url, res => {
      res.pipe(
        tar.x({
          strip: 1,
          C: path,
        }),
      )
      fileLength = parseInt(res.headers['content-length'] || '0', 10)
      bar.start(Math.floor(fileLength / 1024), 0)
      res.on('data', chunk => {
        downloaded += chunk.length
        bar.update(Math.floor(downloaded / 1024))
      })
      res.on('end', () => {
        bar.stop()
        resolve()
      })
      res.on('error', err => {
        bar.stop()
        console.error('Failed to download file')
        reject(err)
      })
    })
  })
}

export async function getWeb3(ws: string): Promise<Web3> {
  const wsProvider = new Web3.providers.WebsocketProvider(ws, {
    reconnect: { auto: true },
  })
  const web3 = new Web3(wsProvider)
  async function waitConnection() {
    return new Promise<void>(res => {
      if (wsProvider.connected) res()
      wsProvider.on('connect', res)
    })
  }
  await waitConnection()
  return web3
}
