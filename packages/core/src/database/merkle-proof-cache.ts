/* eslint-disable max-classes-per-file */
/* eslint-disable radix */
/* eslint-disable @typescript-eslint/camelcase */
// import * as semaphore from 'semaphore-merkle-tree'

import { InanoSQLTableConfig } from '@nano-sql/core/lib/interfaces'

export function merkleProofCache(treeId: string): InanoSQLTableConfig {
  return {
    name: `merkle-proof-cache-${treeId}`,
    model: {
      'nodeIndex:string': { pk: true },
      'value:string': {},
    },
    queries: [
      {
        name: 'cacheNode',
        args: {
          'nodes:obj[]': {
            'nodeIndex:string': {},
            'value:string': {},
          },
        },
        call: (db, args) => {
          return db.query('upsert', args.nodes).emit()
        },
      },
    ],
  }
}
