// import AsyncLock from 'async-lock'
// import SqliteConnector from './connectors/sqlite'
// import { DBConnector } from './types'

export { SQLiteConnector } from './connectors/sqlite'
export { TableData } from './types'
//
// export enum DBType {
//   sqlite = 0,
// }
//
// enum Lock {
//   EXCLUSIVE = 'exclusive',
// }
//
// export class DB {
//   lock: AsyncLock
//
//   conn: DBConnector
//
//   constructor() {
//     this.lock = new AsyncLock()
//     this.conn = {} as any
//   }
//
//   static async create(t: DBType, options: any) {
//     const db = new this()
//     switch (t) {
//       case DBType.sqlite:
//         // initialize
//         db.conn = await SQLiteConnector.create(options)
//         break
//       default:
//         throw new Error(`Unrecognized database type`)
//     }
//     return db
//   }
//
//   async read<T>(query: (conn: DBConnector) => Promise<T>): Promise<T> {
//     const result = await this.lock.acquire(Lock.EXCLUSIVE, async () => {
//       return query(this.conn)
//     })
//     if (result === undefined)
//       throw new Error(`Failed to get data from connector`)
//     return result
//   }
//
//   async write<T>(query: (conn: DBConnector) => Promise<T>): Promise<T> {
//     const result = await this.lock.acquire(Lock.EXCLUSIVE, async () => {
//       return query(this.conn)
//     })
//     if (result === undefined)
//       throw new Error(`Failed to get data from connector`)
//     return result
//   }
// }
