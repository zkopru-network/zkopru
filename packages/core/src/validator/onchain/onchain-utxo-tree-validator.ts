import { Uint256 } from 'soltypes'
import { BlockData, HeaderData, Validation, UtxoTreeValidator } from '../types'
import { blockDataToHexString, headerDataToHexString } from '../utils'
import { OnchainValidatorContext } from './onchain-context'

export class OnchainUtxoTreeValidator extends OnchainValidatorContext
  implements UtxoTreeValidator {
  async validateUTXOIndex(
    block: BlockData,
    parentHeader: HeaderData,
    deposits: Uint256[],
  ): Promise<Validation> {
    const tx = await this.layer1.validators.utxoTree.populateTransaction.validateUTXOIndex(
      blockDataToHexString(block),
      headerDataToHexString(parentHeader),
      deposits.map(d => d.toBigNumber()),
    )
    const result = await this.isSlashable(tx)
    return result
  }

  async validateUTXORoot(
    block: BlockData,
    parentHeader: HeaderData,
    deposits: Uint256[],
    subtreeSiblings: Uint256[],
  ): Promise<Validation> {
    const tx = await this.layer1.validators.utxoTree.populateTransaction.validateUTXORoot(
      blockDataToHexString(block),
      headerDataToHexString(parentHeader),
      deposits.map(d => d.toBigNumber()),
      subtreeSiblings.map(d => d.toBigNumber()),
    )
    const result = await this.isSlashable(tx)
    return result
  }
}
