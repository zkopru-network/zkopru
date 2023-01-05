import { Bytes32, Uint256 } from 'soltypes'
import {
  BlockData,
  HeaderData,
  Validation,
  WithdrawalTreeValidator,
} from '../types'
import { blockDataToHexString, headerDataToHexString } from '../utils'
import { OnchainValidatorContext } from './onchain-context'

export class OnchainWithdrawalTreeValidator extends OnchainValidatorContext
  implements WithdrawalTreeValidator {
  async validateWithdrawalIndex(
    block: BlockData,
    parentHeader: HeaderData,
  ): Promise<Validation> {
    const tx = await this.layer1.validators.withdrawalTree.populateTransaction.validateWithdrawalIndex(
      blockDataToHexString(block),
      headerDataToHexString(parentHeader),
    )
    const result = await this.isSlashable(tx, 'WithdrawalIndex')
    return result
  }

  async validateWithdrawalRoot(
    block: BlockData,
    parentHeader: HeaderData,
    subtreeSiblings: Uint256[],
  ): Promise<Validation> {
    const tx = await this.layer1.validators.withdrawalTree.populateTransaction.validateWithdrawalRoot(
      blockDataToHexString(block),
      headerDataToHexString(parentHeader),
      subtreeSiblings.map(d => d.toString()),
    )
    const result = await this.isSlashable(tx, 'WithdrawalRoot')
    return result
  }

  async validateNullifierRollUp(
    block: BlockData,
    parentHeader: HeaderData,
    numOfNullifiers: Uint256,
    siblings: Bytes32[][],
  ): Promise<Validation> {
    const tx = await this.layer1.validators.nullifierTree.populateTransaction.validateNullifierRollUp(
      blockDataToHexString(block),
      headerDataToHexString(parentHeader),
      numOfNullifiers.toString(),
      siblings.map(sibs => sibs.map(s => s.toString())) as any,
    )
    const result = await this.isSlashable(tx, 'NullifierRollUp')
    return result
  }
}
