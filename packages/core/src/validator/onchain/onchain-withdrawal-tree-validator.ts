import { Bytes32, Uint256 } from 'soltypes'
import {
  BlockData,
  HeaderData,
  OnchainValidation,
  WithdrawalTreeValidator,
} from '../types'
import { blockDataToHexString, headerDataToHexString } from '../utils'
import { OnchainValidatorContext } from './onchain-context'

export class OnchainWithdrawalTreeValidator extends OnchainValidatorContext
  implements WithdrawalTreeValidator {
  async validateWithdrawalIndex(
    block: BlockData,
    parentHeader: HeaderData,
  ): Promise<OnchainValidation> {
    const tx = this.layer1.validators.withdrawalTree.methods.validateWithdrawalIndex(
      blockDataToHexString(block),
      headerDataToHexString(parentHeader),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateWithdrawalRoot(
    block: BlockData,
    parentHeader: HeaderData,
    subtreeSiblings: Uint256[],
  ): Promise<OnchainValidation> {
    const tx = this.layer1.validators.withdrawalTree.methods.validateWithdrawalRoot(
      blockDataToHexString(block),
      headerDataToHexString(parentHeader),
      subtreeSiblings.map(d => d.toString()),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateNullifierRollUp(
    block: BlockData,
    parentHeader: HeaderData,
    numOfNullifiers: Uint256,
    siblings: Bytes32[][],
  ): Promise<OnchainValidation> {
    const tx = this.layer1.validators.nullifierTree.methods.validateNullifierRollUp(
      blockDataToHexString(block),
      headerDataToHexString(parentHeader),
      numOfNullifiers.toString(),
      siblings.map(sibs => sibs.map(s => s.toString())),
    )
    const result = await this.isSlashable(tx)
    return result
  }
}
