/* eslint-disable max-classes-per-file */
/* eslint-disable radix */
/* eslint-disable @typescript-eslint/camelcase */

// eslint-disable-next-line import/named
import { InanoSQLTableConfig } from '@nano-sql/core/lib/interfaces'
import * as utils from '@nano-sql/core/lib/utilities'
import { Accounts } from 'web3-eth-accounts'
import { Point } from '../crypto/jubjub'

export function keystore(): InanoSQLTableConfig {
  return {
    name: 'keystore',
    model: {
      'id:uuid': { pk: true },
      'pubKey: string': {}, // EdDSA pubkey for SNARK
      'address: string': {}, // Ethereum address
      'encrypted: blob': {}, // encrypted form of 32 bytes secret key with AES
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
        args: {
          'secret:string': {},
          'password:string': {},
        },
        call: (db, args) => {
          const sk = args.secret
          const pubKey = Point.fromPrivKey(sk)
            .encode()
            .toString()
          const accounts = new Accounts()
          const id = utils.uuid()
          const encrypted = accounts.encrypt(sk, args.password)
          const { address } = accounts.privateKeyToAccount(sk)
          utils.uuid()
          return db.query('upsert', [{ id, pubKey, address, encrypted }]).emit()
        },
      },
    ],
  }
}
