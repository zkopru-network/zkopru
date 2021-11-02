import { Hasher, keccakHasher, SubTreeLib } from '@zkopru/tree'
import assert from 'assert'
import { Uint256 } from 'soltypes'
import { OutflowType, Withdrawal, ZkOutflow } from '@zkopru/transaction'
import BN from 'bn.js'
import { L2Chain } from '../../context/layer2'
import { headerHash } from '../../block'
import {
  BlockData,
  HeaderData,
  Validation,
  WithdrawalTreeValidator,
} from '../types'
import { blockDataToBlock, headerDataToHeader } from '../utils'
import { OffchainValidatorContext } from './offchain-context'
import { CODE } from '../code'

export class OffchainWithdrawalTreeValidator extends OffchainValidatorContext
  implements WithdrawalTreeValidator {
  hasher: Hasher<BN>

  MAX_WITHDRAWAL: BN

  SUB_TREE_DEPTH: number

  SUB_TREE_SIZE: number

  constructor(layer2: L2Chain) {
    super(layer2)
    this.hasher = keccakHasher(layer2.config.withdrawalTreeDepth)
    this.MAX_WITHDRAWAL = new BN(1).shln(layer2.config.withdrawalTreeDepth)
    this.SUB_TREE_DEPTH = layer2.config.withdrawalSubTreeDepth
    this.SUB_TREE_SIZE = layer2.config.withdrawalSubTreeSize
  }

  async validateWithdrawalIndex(
    blockData: BlockData,
    parentHeaderData: HeaderData,
  ): Promise<Validation> {
    const block = blockDataToBlock(blockData)
    const parentHeader = headerDataToHeader(parentHeaderData)
    assert(
      block.header.parentBlock.eq(headerHash(parentHeader)),
      'Invalid prev header',
    )
    if (block.header.withdrawalIndex.toBN().gt(this.MAX_WITHDRAWAL)) {
      return {
        slashable: true,
        reason: CODE.W2,
      }
    }
    const withdrawalOutflowArr = block.body.txs.reduce((arr, tx) => {
      return [
        ...arr,
        ...tx.outflow.filter(outflow =>
          outflow.outflowType.eqn(OutflowType.WITHDRAWAL),
        ),
      ]
    }, [] as ZkOutflow[])
    const numOfWithdrawals = withdrawalOutflowArr.length
    const numOfSubTrees = Math.ceil(numOfWithdrawals / this.SUB_TREE_SIZE)
    const nextIndex = parentHeader.withdrawalIndex
      .toBN()
      .addn(this.SUB_TREE_SIZE * numOfSubTrees)

    return {
      slashable: !block.header.withdrawalIndex.toBN().eq(nextIndex),
      reason: CODE.W1,
    }
  }

  async validateWithdrawalRoot(
    blockData: BlockData,
    parentHeaderData: HeaderData,
    subTreeSiblings: Uint256[],
  ): Promise<Validation> {
    const block = blockDataToBlock(blockData)
    const parentHeader = headerDataToHeader(parentHeaderData)
    assert(
      block.header.parentBlock.eq(headerHash(parentHeader)),
      'Invalid prev header',
    )
    const newWithdrawals: BN[] = block.body.txs.reduce((arr, tx) => {
      return [
        ...arr,
        ...tx.outflow
          .filter(outflow => outflow.outflowType.eqn(OutflowType.WITHDRAWAL))
          .map(outflow => {
            assert(outflow.data)
            return Withdrawal.withdrawalHash(outflow.note, outflow.data).toBN()
          }),
      ]
    }, [] as BN[])
    const computedRoot = SubTreeLib.appendAsSubTrees(
      this.hasher,
      parentHeader.withdrawalRoot.toBN(),
      parentHeader.withdrawalIndex.toBN(),
      this.SUB_TREE_DEPTH,
      newWithdrawals,
      subTreeSiblings.map(sib => sib.toBN()),
    )
    return {
      slashable: !computedRoot.eq(block.header.withdrawalRoot.toBN()),
      reason: CODE.W3,
    }
  }
}
