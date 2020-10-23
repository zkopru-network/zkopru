import { Bytes32, Uint256 } from 'soltypes'
import { challengeCodeToString } from '../code'
import { BlockData, HeaderData, Slash, WithdrawalTreeValidator } from '../types'
import { blockDataToHexString, headerDataToHexString } from '../utils'
import { OnchainValidatorContext } from './onchain-context'

export class OnchainWithdrawalTreeValidator extends OnchainValidatorContext
  implements WithdrawalTreeValidator {
  async validateWithdrawalIndex(
    block: BlockData,
    parentHeader: HeaderData,
  ): Promise<Slash> {
    const tx = this.layer1.validators.withdrawalTree.methods.validateWithdrawalIndex(
      blockDataToHexString(block),
      headerDataToHexString(parentHeader),
    )
    const result = await tx.call()
    const slash: Slash = {
      slashable: result.slash,
      reason: challengeCodeToString(result.reason),
    }
    return slash
  }

  async validateWithdrawalRoot(
    block: BlockData,
    parentHeader: HeaderData,
    initialSiblings: Uint256[],
  ): Promise<Slash> {
    const tx = this.layer1.validators.withdrawalTree.methods.validateWithdrawalRoot(
      blockDataToHexString(block),
      headerDataToHexString(parentHeader),
      initialSiblings.map(d => d.toString()),
    )
    const result = await tx.call()
    const slash: Slash = {
      slashable: result.slash,
      reason: challengeCodeToString(result.reason),
    }
    return slash
  }

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
