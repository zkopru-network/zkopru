import { genesisRoot, poseidonHasher, keccakHasher } from '@zkopru/tree'
import { bnToBytes32 } from '@zkopru/utils'
import { Address, Bytes32, Uint256 } from 'soltypes'
import BN from 'bn.js'
import { Config } from '@zkopru/database'
import { Header } from './types'

export const genesis = ({
  address,
  parent,
  config,
}: {
  address: Address
  parent: Bytes32
  config: Config
}): Header => {
  const utxoHasher = poseidonHasher(config.utxoTreeDepth)
  const withdrawalHasher = keccakHasher(config.withdrawalTreeDepth)
  const nullifierHasher = keccakHasher(config.nullifierTreeDepth)
  const utxoRoot = genesisRoot(utxoHasher).toUint256()
  const withdrawalRoot = Uint256.from(genesisRoot(withdrawalHasher).toString())
  const nullifierRoot = Bytes32.from(genesisRoot(nullifierHasher).toHexString())
  const zeroBytes = bnToBytes32(new BN(0))
  return {
    proposer: address,
    parentBlock: parent,
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
