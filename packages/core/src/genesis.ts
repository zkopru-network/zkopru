import { Hasher, genesisRoot } from '@zkopru/tree'
import { Field } from '@zkopru/babyjubjub'
import { hexify } from '@zkopru/utils'
import BN from 'bn.js'
import { Header } from './block'

export const genesis = ({
  address,
  hashers,
}: {
  address: string
  hashers: {
    utxo: Hasher<Field>
    withdrawal: Hasher<BN>
    nullifier: Hasher<BN>
  }
}): Header => {
  const utxoRoot = genesisRoot(hashers.utxo).toHex()
  const withdrawalRoot = hexify(genesisRoot(hashers.withdrawal))
  const nullifierRoot = hexify(genesisRoot(hashers.nullifier))
  return {
    proposer: address,
    parentBlock: '0x0000000000000000000000000000000000000000',
    metadata:
      '0x0000000000000000000000000000000000000000000000000000000000000000',
    fee: '0',
    utxoRoot,
    utxoIndex: '0',
    nullifierRoot,
    withdrawalRoot,
    withdrawalIndex: '0',
    txRoot: '0x00',
    depositRoot: '0x00',
    migrationRoot: '0x00',
  }
}
