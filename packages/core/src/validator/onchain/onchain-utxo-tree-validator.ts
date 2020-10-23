import { Uint256 } from 'soltypes'
import { challengeCodeToString } from '../code'
import { BlockData, HeaderData, Slash, UtxoTreeValidator } from '../types'
import { blockDataToHexString, headerDataToHexString } from '../utils'
import { OnchainValidatorContext } from './onchain-context'

export class OnchainUtxoTreeValidator extends OnchainValidatorContext
  implements UtxoTreeValidator {
  async validateUTXOIndex(
    block: BlockData,
    parentHeader: HeaderData,
    deposits: Uint256[],
  ): Promise<Slash> {
    const tx = this.layer1.validators.utxoTree.methods.validateUTXOIndex(
      blockDataToHexString(block),
      headerDataToHexString(parentHeader),
      deposits.map(d => d.toString()),
    )
    const result = await tx.call()
    const slash: Slash = {
      slashable: result.slash,
      reason: challengeCodeToString(result.reason),
    }
    return slash
  }

  async validateUTXORoot(
    block: BlockData,
    parentHeader: HeaderData,
    deposits: Uint256[],
    initialSiblings: Uint256[],
  ): Promise<Slash> {
    const tx = this.layer1.validators.utxoTree.methods.validateUTXORoot(
      blockDataToHexString(block),
      headerDataToHexString(parentHeader),
      deposits.map(d => d.toString()),
      initialSiblings.map(d => d.toString()),
    )
    const result = await tx.call()
    const slash: Slash = {
      slashable: result.slash,
      reason: challengeCodeToString(result.reason),
    }
    return slash
  }
}
