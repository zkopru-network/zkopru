import { Bytes32, Uint256 } from 'soltypes'
import {
  BlockData,
  HeaderData,
  NullifierTreeValidator,
  Validation,
} from '../types'
import { blockDataToHexString, headerDataToHexString } from '../utils'
import { OnchainValidatorContext } from './onchain-context'

export class OnchainNullifierTreeValidator extends OnchainValidatorContext
  implements NullifierTreeValidator {
  async validateNullifierRollUp(
    block: BlockData,
    parentHeader: HeaderData,
    numOfNullifiers: Uint256,
    siblings: Bytes32[][],
  ): Promise<Validation> {
    const tx = await this.layer1.validators.nullifierTree.populateTransaction.validateNullifierRollUp(
      blockDataToHexString(block),
      headerDataToHexString(parentHeader),
      numOfNullifiers.toBigNumber(),
      siblings.map(sibs => sibs.map(s => s.toBigNumber())) as any,
    )
    const result = await this.isSlashable(tx, 'NullifierRollUp')
    return result
  }
}
