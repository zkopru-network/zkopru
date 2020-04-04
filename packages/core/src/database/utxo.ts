import { InanoSQLTableConfig } from '@nano-sql/core/lib/interfaces'
import { UTXO } from '@zkopru/core'

export const utxo: InanoSQLTableConfig = {
  name: 'utxo',
  model: {
    'hash:string': { pk: true },
    'tree:uuid': { foreignKey: 'tree:id', notNull: false },
    'index:string': { notNull: false },
    'eth:string': {},
    'pubKey:string': { notNull: false },
    'salt:string': { notNull: false },
    'tokenAddr:string': { notNull: false },
    'erc20Amount:string': { notNull: false },
    'nft:string': { notNull: false },
    'status:int': { default: 0, min: 0, max: 3 }, // 0: nonIncluded 1: unspent 2: spending 3: spent
    'type:int': { default: 0, min: 0, max: 2 }, // 0: utxo 1: withdrawal 2: migration
    'to:string': { notNull: false },
    'fee:string': { notNull: false },
  },
  indexes: {
    'pubKey:string': {},
    'status:int': {},
  },
  queries: [
    {
      name: 'appendNewUtxos',
      args: { 'utxos:obj[]': {} },
      call: (db, args) => {
        return db
          .query(
            'upsert',
            args.utxos.map((utxo: UTXO) => {
              return {
                hash: utxo.hash(),
                eth: utxo.eth.toHex(),
                pubKey: utxo.pubKey.toHex(),
                salt: utxo.salt.toHex(),
                tokenAddr: utxo.tokenAddr.toHex(),
                erc20Amount: utxo.erc20Amount.toHex(),
                nft: utxo.nft.toHex(),
                status: utxo.status || 0,
                type: utxo.outflowType().toNumber(),
                to: utxo.publicData?.to || undefined,
                fee: utxo.publicData?.fee || undefined,
              }
            }),
          )
          .emit()
      },
    },
    {
      name: 'markAsIncluded',
      args: {
        'utxos:obj[]': {
          'hash:string': {},
          'tree:uuid': {},
          'index:string': {},
        },
      },
      call: (db, args) => {
        return db
          .query(
            'upsert',
            args.utxos.map(utxo => {
              return {
                status: 1,
                ...utxo,
              }
            }),
          )
          .emit()
      },
    },
    {
      name: 'getSpendables',
      args: {
        'zkopru:uuid': {},
        'pubKeys:string[]': {},
      },
      call: (db, args) => {
        return db
          .query('select')
          .join({
            type: 'left',
            with: { table: 'tree' },
            on: ['utxo.tree', '=', 'tree.id'],
          })
          .where([
            [['tree.zkopru', '=', args.zkopru], 'AND', ['utxo.type', '=', 0]],
            'AND',
            [
              ['utxo.pubKey', 'IN', args.pubKeys],
              'AND',
              ['utxo.status', '=', 1],
            ],
          ])
          .emit()
      },
    },
    {
      name: 'getWithdrawables',
      args: {
        'zkopru:uuid': {},
        'addresses:string[]': {},
      },
      call: (db, args) => {
        return db
          .query('select')
          .join({
            type: 'left',
            with: { table: 'tree' },
            on: ['utxo.tree', '=', 'tree.id'],
          })
          .where([
            [['tree.zkopru', '=', args.zkopru], 'AND', ['utxo.type', '=', 1]],
            'AND',
            [['utxo.to', 'IN', args.addresses], 'AND', ['utxo.status', '=', 1]],
          ])
          .emit()
      },
    },
    {
      name: 'getMigratables',
      args: {
        'zkopru:uuid': {},
        'addresses:string[]': {},
      },
      call: (db, args) => {
        return db
          .query('select')
          .join({
            type: 'left',
            with: { table: 'tree' },
            on: ['utxo.tree', '=', 'tree.id'],
          })
          .where([
            [['tree.zkopru', '=', args.zkopru], 'AND', ['utxo.type', '=', 2]],
            'AND',
            [['utxo.to', 'IN', args.addresses], 'AND', ['utxo.status', '=', 1]],
          ])
          .emit()
      },
    },
    {
      name: 'markAsSpending',
      args: {
        'utxos:string[]': {},
      },
      call: (db, args) => {
        return db
          .query(
            'upsert',
            args.utxos.map((hash: string) => {
              return { hash, status: 2 }
            }),
          )
          .emit()
      },
    },
    {
      name: 'markAsSpent',
      args: {
        'utxos:string[]': {},
      },
      call: (db, args) => {
        return db
          .query(
            'upsert',
            args.utxos.map((hash: string) => {
              return { hash, status: 3 }
            }),
          )
          .emit()
      },
    },
    {
      name: 'clearSpentUtxos',
      args: {},
      call: (db, _) => {
        return db
          .query('delete')
          .where(['status', '=', 3])
          .emit()
      },
    },
  ],
}
