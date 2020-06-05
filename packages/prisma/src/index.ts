import { Field, F } from '@zkopru/babyjubjub'
import { v4 } from 'uuid'
import { TreeNode, PrismaClient, PrismaClientOptions } from '@prisma/client'
import BN from 'bn.js'
import path from 'path'
import fs from 'fs'

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

export {
  LightTree,
  TreeNode,
  Nullifier,
  Keystore,
  EncryptedWallet,
  Block,
  Header,
} from '@prisma/client'

export class DB {
  constructor(option?: PrismaClientOptions) {
    this.prisma = new PrismaClient(option)
  }

  prisma: PrismaClient

  preset = {
    getCachedSiblings: async (
      depth: number,
      treeId: string,
      leafIndex: F,
    ): Promise<TreeNode[]> => {
      const siblingIndexes = Array(depth).fill('')
      const leafPath = Field.toBN(leafIndex).or(new BN(1).shln(depth))
      for (let level = 0; level < depth; level += 1) {
        const pathIndex = leafPath.shrn(level)
        const siblingIndex = pathIndex.xor(new BN(1))
        siblingIndexes[level] = `0x${siblingIndex.toString('hex')}`
      }
      const cachedSiblings = await this.prisma.treeNode.findMany({
        where: {
          treeId,
          nodeIndex: {
            in: [...siblingIndexes],
          },
        },
      })
      return cachedSiblings
    },
  }

  static async mockup(): Promise<{
    instance: DB
    terminate: () => Promise<void>
  }> {
    const dbName = `${v4()}.db`
    const dbPath = `${path.join(path.resolve('.'), dbName)}`
    const predefined = `${path.join(
      path.resolve(__dirname),
      '../prisma/schema.db',
    )}`
    console.log('predefiend, ', predefined)
    fs.promises.copyFile(predefined, dbPath)
    const instance = new DB({
      datasources: {
        sqlite: `file://${dbPath}`,
      },
    })
    const terminate = async () => {
      fs.unlinkSync(dbPath)
      await instance.prisma.disconnect()
    }
    return { instance, terminate }
  }
}
