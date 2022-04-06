import { Hasher, keccakHasher, SMT } from '@zkopru/tree'
import assert from 'assert'
import { Bytes32, Uint256 } from 'soltypes'
import { BigNumber } from 'ethers'
import { L2Chain } from '../../context/layer2'
import { headerHash } from '../../block'
import {
  BlockData,
  HeaderData,
  NullifierTreeValidator,
  Validation,
} from '../types'
import { blockDataToBlock, headerDataToHeader } from '../utils'
import { OffchainValidatorContext } from './offchain-context'
import { CODE } from '../code'

export class OffchainNullifierTreeValidator extends OffchainValidatorContext
  implements NullifierTreeValidator {
  hasher: Hasher<BigNumber>

  constructor(layer2: L2Chain) {
    super(layer2)
    this.hasher = keccakHasher(layer2.config.nullifierTreeDepth)
  }

  async validateNullifierRollUp(
    blockData: BlockData,
    parentHeaderData: HeaderData,
    numOfNullifiers: Uint256,
    siblingsArr: Bytes32[][],
  ): Promise<Validation> {
    const block = blockDataToBlock(blockData)
    const parentHeader = headerDataToHeader(parentHeaderData)
    assert(
      block.header.parentBlock.eq(headerHash(parentHeader)),
      'Invalid prev header',
    )
    const nullifiers = block.body.txs.reduce((arr, tx) => {
      return [...arr, ...tx.inflow.map(inflow => inflow.nullifier)]
    }, [] as BigNumber[])
    assert(
      numOfNullifiers.toBigNumber().eq(nullifiers.length),
      'Invalid numOfNullifier',
    )
    const computedRoot = SMT.batchFill(
      this.hasher,
      parentHeader.nullifierRoot.toBigNumber(),
      nullifiers,
      siblingsArr.map(arr => arr.map(sib => sib.toBigNumber())),
    )
    // Return the result
    const slash: Validation = {
      // NFT cannot exists more than 1
      slashable: computedRoot.eq(block.header.nullifierRoot.toBigNumber()),
      reason: CODE.N1,
    }
    return slash
  }
}
