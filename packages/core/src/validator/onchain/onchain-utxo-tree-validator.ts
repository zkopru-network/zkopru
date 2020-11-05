import { Uint256 } from 'soltypes'
import {
  BlockData,
  HeaderData,
  OnchainValidation,
  UtxoTreeValidator,
} from '../types'
import { blockDataToHexString, headerDataToHexString } from '../utils'
import { OnchainValidatorContext } from './onchain-context'

export class OnchainUtxoTreeValidator extends OnchainValidatorContext
  implements UtxoTreeValidator {
  async validateUTXOIndex(
    block: BlockData,
    parentHeader: HeaderData,
    deposits: Uint256[],
  ): Promise<OnchainValidation> {
    const tx = this.layer1.validators.utxoTree.methods.validateUTXOIndex(
      blockDataToHexString(block),
      headerDataToHexString(parentHeader),
      deposits.map(d => d.toString()),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateUTXORoot(
    block: BlockData,
    parentHeader: HeaderData,
    deposits: Uint256[],
    subtreeSiblings: Uint256[],
  ): Promise<OnchainValidation> {
    const tx = this.layer1.validators.utxoTree.methods.validateUTXORoot(
      blockDataToHexString(block),
      headerDataToHexString(parentHeader),
      deposits.map(d => d.toString()),
      subtreeSiblings.map(d => d.toString()),
    )
    const result = await this.isSlashable(tx)
    return result
  }
}
