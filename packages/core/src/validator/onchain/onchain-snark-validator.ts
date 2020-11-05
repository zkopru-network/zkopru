import { Uint256 } from 'soltypes'
import { BlockData, OnchainValidation, TxSNARKValidator } from '../types'
import { blockDataToHexString } from '../utils'
import { OnchainValidatorContext } from './onchain-context'

export class OnchainTxSNARKValidator extends OnchainValidatorContext
  implements TxSNARKValidator {
  async validateSNARK(
    block: BlockData,
    txIndex: Uint256,
  ): Promise<OnchainValidation> {
    const tx = this.layer1.validators.snark.methods.validateSNARK(
      blockDataToHexString(block),
      txIndex.toString(),
    )
    const result = await this.isSlashable(tx)
    return result
  }
}
