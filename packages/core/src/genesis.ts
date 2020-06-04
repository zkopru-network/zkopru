import { L1Config } from '@zkopru/database'
import { genesisRoot, poseidonHasher, keccakHasher } from '@zkopru/tree'
import { bnToBytes32 } from '@zkopru/utils'
import { Address, Bytes32 } from 'soltypes'
import BN from 'bn.js'
import { Header } from './block'

export const genesis = ({
  address,
  parent,
  config,
}: {
  address: Address
  parent: Bytes32
  config: L1Config
}): Header => {
  const utxoHasher = poseidonHasher(config.utxoTreeDepth)
  const withdrawalHasher = keccakHasher(config.withdrawalTreeDepth)
  const nullifierHasher = keccakHasher(config.nullifierTreeDepth)
  const utxoRoot = genesisRoot(utxoHasher).toUint256()
  const withdrawalRoot = bnToBytes32(genesisRoot(withdrawalHasher))
  const nullifierRoot = bnToBytes32(genesisRoot(nullifierHasher))
  const zeroBytes = bnToBytes32(new BN(0))
  return {
    proposer: address,
    parentBlock: parent,
    metadata: zeroBytes,
    fee: zeroBytes.toUint(),
    utxoRoot,
    utxoIndex: zeroBytes.toUint(),
    nullifierRoot,
    withdrawalRoot,
    withdrawalIndex: zeroBytes.toUint(),
    txRoot: zeroBytes,
    depositRoot: zeroBytes,
    migrationRoot: zeroBytes,
  }
}
