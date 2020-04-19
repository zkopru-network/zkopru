import { Hasher, genesisRoot } from '@zkopru/tree'
import { Header } from './block'

export const genesis = ({
  address,
  hashers,
}: {
  address: string
  hashers: {
    utxo: Hasher
    withdrawal: Hasher
    nullifier: Hasher
  }
}): Header => {
  const utxoRoot = genesisRoot(hashers.utxo).toHex()
  const withdrawalRoot = genesisRoot(hashers.withdrawal).toHex()
  const nullifierRoot = genesisRoot(hashers.nullifier).toHex()
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
