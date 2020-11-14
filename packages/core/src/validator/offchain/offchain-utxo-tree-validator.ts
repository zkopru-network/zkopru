import { Field } from '@zkopru/babyjubjub'
import { Hasher, poseidonHasher, SubTreeLib } from '@zkopru/tree'
import assert from 'assert'
import { Bytes32, Uint256 } from 'soltypes'
import { soliditySha3Raw } from 'web3-utils'
import { OutflowType, ZkOutflow } from '@zkopru/transaction'
import BN from 'bn.js'
import { L2Chain } from '../../context/layer2'
import { Block, headerHash } from '../../block'
import { BlockData, HeaderData, Validation, UtxoTreeValidator } from '../types'
import { blockDataToBlock, headerDataToHeader } from '../utils'
import { OffchainValidatorContext } from './offchain-context'
import { CODE } from '../code'

export class OffchainUtxoTreeValidator extends OffchainValidatorContext
  implements UtxoTreeValidator {
  hasher: Hasher<Field>

  MAX_UTXO: BN

  SUB_TREE_DEPTH: number

  SUB_TREE_SIZE: number

  constructor(layer2: L2Chain) {
    super(layer2)
    this.hasher = poseidonHasher(layer2.config.utxoTreeDepth)
    this.MAX_UTXO = new BN(1).shln(layer2.config.utxoTreeDepth)
    this.SUB_TREE_DEPTH = layer2.config.utxoSubTreeDepth
    this.SUB_TREE_SIZE = layer2.config.utxoSubTreeSize
  }

  private static checkSubmittedDeposits(
    block: Block,
    deposits: Uint256[],
  ): boolean {
    let depositIndex = 0
    for (let i = 0; i < block.body.massDeposits.length; i += 1) {
      let merged = Uint256.from('0').toBytes()
      while (!block.body.massDeposits[i].merged.eq(merged)) {
        merged = Bytes32.from(
          soliditySha3Raw(
            merged.toString(),
            deposits[depositIndex].toBytes().toString(),
          ),
        )
        depositIndex += 1
        if (depositIndex > deposits.length) return false
      }
    }
    return depositIndex === deposits.length
  }

  async validateUTXOIndex(
    blockData: BlockData,
    parentHeaderData: HeaderData,
    deposits: Uint256[],
  ): Promise<Validation> {
    const block = blockDataToBlock(blockData)
    const parentHeader = headerDataToHeader(parentHeaderData)
    assert(
      OffchainUtxoTreeValidator.checkSubmittedDeposits(block, deposits),
      'Submitted invalid deposit data',
    )
    assert(
      block.header.parentBlock.eq(headerHash(parentHeader)),
      'Invalid prev header',
    )
    if (block.header.utxoIndex.toBN().gt(this.MAX_UTXO)) {
      return {
        slashable: true,
        reason: CODE.U2,
      }
    }
    const utxoOutflowArr = block.body.txs.reduce((arr, tx) => {
      return [
        ...arr,
        ...tx.outflow.filter(outflow =>
          outflow.outflowType.eqn(OutflowType.UTXO),
        ),
      ]
    }, [] as ZkOutflow[])
    const numOfUtxos = deposits.length + utxoOutflowArr.length
    const numOfSubTrees = Math.ceil(numOfUtxos / this.SUB_TREE_SIZE)
    const nextIndex = parentHeader.utxoIndex
      .toBN()
      .addn(this.SUB_TREE_SIZE * numOfSubTrees)
    return {
      slashable: !block.header.utxoIndex.toBN().eq(nextIndex),
      reason: CODE.U1,
    }
  }

  async validateUTXORoot(
    blockData: BlockData,
    parentHeaderData: HeaderData,
    deposits: Uint256[],
    subTreeSiblings: Uint256[],
  ): Promise<Validation> {
    const block = blockDataToBlock(blockData)
    assert(
      OffchainUtxoTreeValidator.checkSubmittedDeposits(block, deposits),
      'Submitted invalid deposit data',
    )
    const parentHeader = headerDataToHeader(parentHeaderData)
    assert(
      block.header.parentBlock.eq(headerHash(parentHeader)),
      'Invalid prev header',
    )
    const newUtxos: Field[] = block.body.txs.reduce(
      (arr, tx) => {
        return [
          ...arr,
          ...tx.outflow
            .filter(outflow => outflow.outflowType.eqn(OutflowType.UTXO))
            .map(outflow => outflow.note),
        ]
      },
      deposits.map(deposit => Field.from(deposit.toString())),
    )
    const computedRoot = SubTreeLib.appendAsSubTrees(
      this.hasher,
      Field.from(parentHeader.utxoRoot.toString()),
      Field.from(parentHeader.utxoIndex.toString()),
      this.SUB_TREE_DEPTH,
      newUtxos,
      subTreeSiblings.map(sib => Field.from(sib.toString())),
    )
    return {
      slashable: !computedRoot.eq(block.header.utxoRoot.toBN()),
      reason: CODE.U3,
    }
  }
}
