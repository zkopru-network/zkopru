/* eslint-disable jest/no-disabled-tests */

import { InanoSQLInstance, nSQL } from '@nano-sql/core'
import { schema } from '@zkopru/database'
import { Grove, poseidonHasher, keccakHasher } from '~tree'
import { address, keys } from '../testset'

/* eslint-disable jest/no-hooks */
describe.skip('grove unit test', () => {
  let grove: Grove
  let db: InanoSQLInstance
  beforeAll(async () => {
    const dbName = 'unittest'
    await nSQL().createDatabase({
      id: dbName,
      mode: 'TEMP',
      tables: [
        schema.utxo,
        schema.utxoTree,
        schema.withdrawal,
        schema.withdrawalTree,
        schema.nullifiers,
        schema.nullifierTreeNode,
      ],
      version: 3,
    })
    db = nSQL()
    grove = new Grove('temp', db, {
      utxoTreeDepth: 31,
      withdrawalTreeDepth: 31,
      utxoSubTreeSize: 32,
      withdrawalSubTreeSize: 32,
      nullifierTreeDepth: 254,
      utxoHasher: poseidonHasher(31),
      withdrawalHasher: keccakHasher(31),
      nullifierHasher: keccakHasher(256),
      fullSync: false,
      forceUpdate: !true,
      pubKeysToObserve: [keys.alicePubKey],
      addressesToObserve: [address.USER_A],
    })
    await grove.init()
  })
  it('should be successfully initialized with given values', () => {
    expect(grove).toBeDefined()
  })
})
