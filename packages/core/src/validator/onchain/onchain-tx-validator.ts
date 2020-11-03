import { Bytes32, Uint256 } from 'soltypes'
import { BlockData, HeaderData, OnchainValidation, TxValidator } from '../types'
import { blockDataToHexString, headerDataToHexString } from '../utils'
import { OnchainValidatorContext } from './onchain-context'

export class OnchainTxValidator extends OnchainValidatorContext
  implements TxValidator {
  async validateInclusion(
    block: BlockData,
    txIndex: Uint256,
    inflowIndex: Uint256,
  ): Promise<OnchainValidation> {
    const tx = this.layer1.validators.tx.methods.validateInclusion(
      blockDataToHexString(block),
      txIndex.toString(),
      inflowIndex.toString(),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateOutflow(
    block: BlockData,
    txIndex: Uint256,
  ): Promise<OnchainValidation> {
    const tx = this.layer1.validators.tx.methods.validateOutflow(
      blockDataToHexString(block),
      txIndex.toString(),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateAtomicSwap(
    block: BlockData,
    txIndex: Uint256,
  ): Promise<OnchainValidation> {
    const tx = this.layer1.validators.tx.methods.validateAtomicSwap(
      blockDataToHexString(block),
      txIndex.toString(),
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
  ): Promise<OnchainValidation> {
    const tx = this.layer1.validators.tx.methods.validateUsedNullifier(
      blockDataToHexString(block),
      headerDataToHexString(parentHeader),
      txIndex.toString(),
      inflowIndex.toString(),
      siblings.map(s => s.toString()),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateDuplicatedNullifier(
    block: BlockData,
    txIndex: Bytes32,
  ): Promise<OnchainValidation> {
    const tx = this.layer1.validators.tx.methods.validateDuplicatedNullifier(
      blockDataToHexString(block),
      txIndex.toString(),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateSNARK(
    block: BlockData,
    txIndex: Uint256,
  ): Promise<OnchainValidation> {
    const tx = this.layer1.validators.tx.methods.validateSNARK(
      blockDataToHexString(block),
      txIndex.toString(),
    )
    const result = await this.isSlashable(tx)
    return result
  }
}
