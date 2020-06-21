import { Field, F } from '@zkopru/babyjubjub'
import { hexify } from '@zkopru/utils'
import { v4 } from 'uuid'
import {
  TreeNode,
  Utxo,
  Withdrawal,
  Migration,
  PrismaClient,
  PrismaClientOptions,
} from '@prisma/client'
import BN from 'bn.js'
import path from 'path'
import fs from 'fs'
import AsyncLock from 'async-lock'

export type NoteSql = Utxo | Withdrawal | Migration

export enum TreeSpecies {
  UTXO = 0,
  WITHDRAWAL = 1,
}

export enum BlockStatus {
  NOT_FETCHED = 0,
  FETCHED = 1,
  PARTIALLY_VERIFIED = 2,
  FULLY_VERIFIED = 3,
  FINALIZED = 4,
  INVALIDATED = 5,
  REVERTED = 6,
}

export const NULLIFIER_TREE_ID = 'nullifier-tree'

export {
  LightTree,
  TreeNode,
  Keystore,
  EncryptedWallet,
  Block,
  Header,
  Bootstrap,
  BootstrapCreateInput,
  Config,
  Deposit,
  MassDeposit,
  Proposal,
} from '@prisma/client'

export interface MockupDB {
  db: DB
  terminate: () => Promise<void>
}

enum Lock {
  EXCLUSIVE = 'exclusive',
}

export class DB {
  lock: AsyncLock

  constructor(option?: PrismaClientOptions) {
    this.prisma = new PrismaClient(option)
    this.lock = new AsyncLock()
  }

  prisma: PrismaClient

  async read<T>(query: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    let result: T | undefined
    if (this.lock.isBusy(Lock.EXCLUSIVE)) {
      await this.lock.acquire(Lock.EXCLUSIVE, async () => {
        result = await query(this.prisma)
      })
    } else {
      result = await query(this.prisma)
    }
    if (result === undefined) throw Error('Failed to get data from db')
    return result
  }

  async write<T>(query: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    let result: T | undefined
    await this.lock.acquire([Lock.EXCLUSIVE], async () => {
      result = await query(this.prisma)
    })
    if (result === undefined) throw Error('Failed to write data from db')
    return result
  }

  preset = {
    getCachedSiblings: async (
      depth: number,
      treeId: string,
      leafIndex: F,
    ): Promise<TreeNode[]> => {
      const siblingIndexes = Array(depth).fill('')
      const leafPath = new BN(1).shln(depth).or(Field.toBN(leafIndex))
      if (leafPath.lte(Field.toBN(leafIndex)))
        throw Error('Leaf index is out of range')

      for (let level = 0; level < depth; level += 1) {
        const pathIndex = leafPath.shrn(level)
        const siblingIndex = new BN(1).xor(pathIndex)
        siblingIndexes[level] = hexify(siblingIndex)
      }
      const cachedSiblings = await this.read(prisma =>
        prisma.treeNode.findMany({
          where: {
            treeId,
            nodeIndex: {
              in: [...siblingIndexes],
            },
          },
        }),
      )
      return cachedSiblings
    },
  }

  static async mockup(name?: string): Promise<MockupDB> {
    const dbName = name || `${v4()}.db`
    const dbPath = path.join(path.resolve('.'), dbName)
    const dirPath = path.join(dbPath, '../')
    fs.mkdirSync(dirPath, { recursive: true })
    const predefined = `${path.join(
      path.resolve(__dirname),
      '../prisma/dev.db',
    )}`
    await fs.promises.copyFile(predefined, dbPath)
    const db = new DB({
      datasources: {
        sqlite: `file://${dbPath}`,
      },
    })
    const terminate = async () => {
      fs.unlinkSync(dbPath)
      await db.prisma.disconnect()
    }
    return { db, terminate }
  }

  /**
  static getMigrator(): Migrate {
    const schemaPath = `${path.join(
      path.resolve(__dirname),
      '../prisma/schema.prisma',
    )}`
    const migrate = new Migrate(schemaPath)
    return migrate
  }
  */
}
