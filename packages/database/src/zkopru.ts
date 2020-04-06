import { InanoSQLTableConfig } from '@nano-sql/core/lib/interfaces'

export const zkopru: InanoSQLTableConfig = {
  name: 'zkopru',
  model: {
    'id:uuid': { pk: true },
    'networkId:int': {},
    'address:string': {},
    // 'utxoTrees:uuid[]': {},
    // 'withdrawalTrees:uuid[]': {},
    // 'nullifierTree:uuid': {},
    'config:obj': {
      model: {
        'utxoTreeDepth:int': {},
        'withdrawalTreeDepth:int': {},
        'nullifierTreeDepth:int': {},
        'utxoPreHashes:string[]': {},
        'withdrawalPreHashes:string[]': {},
        'nullifierPreHashes:string[]': {},
        'challengePeriod:int': {},
        'challengeLimit:int': {},
        'minimumStake:string': {},
        'referenceDepth:int': {},
        'poolSize:int': {},
        'subTreeDepth:int': {},
        'subTreeSize:int': {},
      },
    },
    'withdrawalSnapshot:string': {},
    'snapshotTimestamp:string': {},
  },
  indexes: {
    'networkId:int': {},
    'address:string': {},
  },
  queries: [
    {
      name: 'create',
      args: {
        'networkId:int': {},
        'address:string': {},
        'config:obj': {},
      },
      call: (db, args) => {
        return db
          .query('upsert', [
            {
              networkdId: args.networkId,
              address: args.address,
              config: args.config,
            },
          ])
          .emit()
      },
    },
    {
      name: 'read',
      args: {
        'networkdId:int': {},
        'address:string': {},
      },
      call: (db, args) => {
        return db
          .query('select')
          .where([
            ['networkId', '=', args.networkId],
            'AND',
            ['address', '=', args.address],
          ])
          .emit()
      },
    },
    {
      name: 'update',
      args: {
        'networkId:int': {},
        'address:string': {},
        'config:obj': {},
      },
      call: (db, args) => {
        return db
          .query('upsert', [
            {
              config: args.config,
            },
          ])
          .where([
            ['networkId', '=', args.networkId],
            'AND',
            ['address', '=', args.address],
          ])
          .emit()
      },
    },
    {
      name: 'delete',
      args: {
        'networkId:int': {},
        'address:string': {},
      },
      call: (db, args) => {
        return db
          .query('delete')
          .where([
            ['networkId', '=', args.networkId],
            'AND',
            ['address', '=', args.address],
          ])
          .emit()
      },
    },
  ],
}
