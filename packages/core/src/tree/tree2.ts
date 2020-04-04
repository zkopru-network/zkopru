// /* eslint-disable max-classes-per-file */
// /* eslint-disable radix */
// /* eslint-disable @typescript-eslint/camelcase */
// // import * as semaphore from 'semaphore-merkle-tree'

// import { nSQL } from '@nano-sql/core'
// import {
//   InanoSQLInstance,
//   InanoSQLAdapter,
//   InanoSQLConfig,
// } from '@nano-sql/core/lib/interfaces'

// export class LightTree {
//   id: string

//   adapter: string | InanoSQLAdapter

//   nanoSQL!: InanoSQLInstance

//   constructor(id: string, adapter?: InanoSQLAdapter) {
//     this.id = id
//     this.adapter = adapter || 'PERM'
//   }

//   private tableConfigs(): InanoSQLTableConfig[] {
//     return [
//       {
//         name: "utxoTrees",
//         model: {
//           "id: int": { pk: true, ai: true },
//           "",
//         }
//       }
//     ]
//   }

//   private siblignTable(treeIndex): InanoSQLConfig {

//   }

//   private treeConfig(treeIndex: ): InanoSQLConfig {
//     return {
//       name: ""
//     }
//   }

//   async init() {
//     const existingDatabases = nSQL().listDatabases()
//     if (!existingDatabases.find(name => name === this.id)) {
//       await nSQL().createDatabase({
//         id: this.id,
//         mode: this.adapter,
//         tables: [],
//       })
//     }
//     this.nanoSQL = nSQL().useDatabase(this.id)
//   }
// }

