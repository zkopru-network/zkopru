import AsyncLock from 'async-lock'
// import SqliteConnector from './connectors/sqlite'
import { DBConnector } from './types'

enum DBType {
  sqlite=0,
}

enum Lock {
  EXCLUSIVE='exclusive'
}

export class DB {
  lock: AsyncLock
  conn: DBConnector

  constructor(t: DBType) {
    switch (t) {
      case DBType.sqlite:
        // initialize
        this.conn = undefined as unknown as DBConnector
        // this.conn = new SqliteConnector(...options)
        break
      default:
        throw new Error(`Unrecognized database type`)
    }
    this.lock = new AsyncLock()
  }

  async read<T>(query: (conn: DBConnector) => Promise<T>): Promise<T> {
    const result = await this.lock.acquire(Lock.EXCLUSIVE, async () => {
      return query(this.conn)
    })
    if (result === undefined) throw new Error(`Failed to get data from connector`)
    return result
  }

  async write<T>(query: (conn: DBConnector) => Promise<T>): Promise<T> {
    const result = await this.lock.acquire(Lock.EXCLUSIVE, async () => {
      return query(this.conn)
    })
    if (result === undefined) throw new Error(`Failed to get data from connector`)
    return result
  }

}
