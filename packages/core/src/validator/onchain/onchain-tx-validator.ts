import { Bytes32, Uint256 } from 'soltypes'
import { BlockData, HeaderData, Validation, TxValidator } from '../types'
import { blockDataToHexString, headerDataToHexString } from '../utils'
import { OnchainValidatorContext } from './onchain-context'

export class OnchainTxValidator extends OnchainValidatorContext
  implements TxValidator {
  async validateInclusion(
    block: BlockData,
    txIndex: Uint256,
    inflowIndex: Uint256,
  ): Promise<Validation> {
    const tx = await this.layer1.validators.tx.populateTransaction.validateInclusion(
      blockDataToHexString(block),
      txIndex.toBigNumber(),
      inflowIndex.toBigNumber(),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateOutflow(
    block: BlockData,
    txIndex: Uint256,
  ): Promise<Validation> {
    const tx = await this.layer1.validators.tx.populateTransaction.validateOutflow(
      blockDataToHexString(block),
      txIndex.toBigNumber(),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateAtomicSwap(
    block: BlockData,
    txIndex: Uint256,
  ): Promise<Validation> {
    const tx = await this.layer1.validators.tx.populateTransaction.validateAtomicSwap(
      blockDataToHexString(block),
      txIndex.toBigNumber(),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateUsedNullifier(
    block: BlockData,
    parentHeader: HeaderData,
    txIndex: Uint256,
    inflowIndex: Uint256,
    siblings: Bytes32[],
  ): Promise<Validation> {
    const tx = await this.layer1.validators.tx.populateTransaction.validateUsedNullifier(
      blockDataToHexString(block),
      headerDataToHexString(parentHeader),
      txIndex.toBigNumber(),
      inflowIndex.toBigNumber(),
      siblings.map(s => s.toBigNumber()) as any,
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateDuplicatedNullifier(
    block: BlockData,
    nullifier: Bytes32,
  ): Promise<Validation> {
    const tx = await this.layer1.validators.tx.populateTransaction.validateDuplicatedNullifier(
      blockDataToHexString(block),
      nullifier.toString(),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateSNARK(block: BlockData, txIndex: Uint256): Promise<Validation> {
    const tx = await this.layer1.validators.tx.populateTransaction.validateSNARK(
      blockDataToHexString(block),
      txIndex.toBigNumber(),
    )
    const result = await this.isSlashable(tx)
    return result
  }
}
