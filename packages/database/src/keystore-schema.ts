import { EncryptedKeystoreV3Json } from 'web3-core'
import { InanoSQLTableConfig } from '@nano-sql/core/lib/interfaces'

export interface KeystoreSql {
  id?: string
  pubKey?: string
  address?: string
  encrypted?: EncryptedKeystoreV3Json
}

export const keystore: InanoSQLTableConfig = {
  name: 'keystore',
  model: {
    'id:uuid': { pk: true },
    'pubKey: string': {}, // EdDSA pubkey for SNARK
    'address: string': {}, // Ethereum address
    'encrypted: obj': {}, // encrypted form of 32 bytes secret key with AES
  },
  indexes: {
    'pubKey: string': {}, // used as a foreign key for the utxo list
  },
  queries: [
    {
      name: 'getKeys',
      args: {},
      call: (db, _) => {
        return db
          .query('select')
          .where(['track', '=', 'true'])
          .emit()
      },
    },
    {
      name: 'addKey',
      args: {},
      call: (db, args: KeystoreSql) => {
        return db.query('upsert', [args]).emit()
      },
    },
  ],
}
