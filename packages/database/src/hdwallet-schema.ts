import { InanoSQLTableConfig } from '@nano-sql/core/lib/interfaces'

export interface HDWalletSql {
  id?: string
  ciphertext: string
  iv: string
  algorithm: string
  keylen: number
  kdf: string
  kdfParams: object
  salt: string
  updated?: string
}

export const hdWallet: InanoSQLTableConfig = {
  name: 'hdwallet',
  model: {
    'id:uuid': { pk: true },
    'ciphertext:string': {},
    'iv:string': {},
    'algorithm:string': {},
    'keylen:number': {},
    'kdf:string': {},
    'kdfParams:obj': {},
    'salt:string': {},
    'updated:date': {},
  },
  queries: [
    {
      name: 'save',
      args: { 'hdWallet:object': {} },
      call: (db, args: { [hdWallet: string]: HDWalletSql }) => {
        return db
          .query('upsert', [{ updated: Date.now(), ...args.hdWallet }])
          .emit()
      },
    },
  ],
}
