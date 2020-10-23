import { Bytes32, Uint256 } from 'soltypes'
import { challengeCodeToString } from '../code'
import { BlockData, HeaderData, NullifierTreeValidator, Slash } from '../types'
import { blockDataToHexString, headerDataToHexString } from '../utils'
import { OnchainValidatorContext } from './onchain-context'

export class OnchainNullifierTreeValidator extends OnchainValidatorContext
  implements NullifierTreeValidator {
  async validateNullifierRollUp(
    block: BlockData,
    parentHeader: HeaderData,
    numOfNullifiers: Uint256,
    siblings: Bytes32[][],
  ): Promise<Slash> {
    const tx = this.layer1.validators.nullifierTree.methods.validateNullifierRollUp(
      blockDataToHexString(block),
      headerDataToHexString(parentHeader),
      numOfNullifiers.toString(),
      siblings.map(sibs => sibs.map(s => s.toString())),
    )
    const result = await tx.call()
    const slash: Slash = {
      slashable: result.slash,
      reason: challengeCodeToString(result.reason),
    }
    return slash
  }
}
