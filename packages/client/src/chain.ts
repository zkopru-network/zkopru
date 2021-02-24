import { SNARKVerifier } from '@zkopru/core'
import ZkopruClient from '.'

interface Block {

}

type WhereClause = { [key: string]: any }

interface DataDelegate {
  create: (collection: string, doc: Object) => Promise<Object>
  findOne: (collection: string, where: WhereClause) => Promise<Object>
  // retrieve many documents matching a where clause
  findMany: (collection: string, where: WhereClause, options: {
    orderBy?: {
      [key: string]: 'asc' | 'desc'
    },
    take?: number,
  }) => Promise<Object[]>
  // count document matching a where clause
  count: (collection: string, where: WhereClause) => Promise<number>
  // update some documents returning the number updated
  update: (collection: string, where: WhereClause, changes: Object) => Promise<number>
  // update or create some documents
  upsert: (collection: string, where: WhereClause, options: {
    update: Object,
    create: Object,
  }) => Promise<{ created: number, updated: number }>
  // request that an index be created between some keys, if supported
  ensureIndex: (collection: string, name: string, keys: string[]) => void
}

export class ZKChain {
  storageDelegate: DataDelegate
  nodeUrl: string
  client: ZkopruClient
  verifier: SNARKVerifier

  synchronizing: boolean = false

  constructor(nodeUrl: string, delegate: DataDelegate) {
    this.storageDelegate = delegate
    this.nodeUrl = nodeUrl
    this.client = new ZkopruClient(this.nodeUrl)
    this.verifier = new SNARKVerifier({} as any)
  }

  // private loadVerifier() {
  //
  // }

  startSync() {
    if (this.synchronizing) return
    this.synchronizing = true

  }
}
