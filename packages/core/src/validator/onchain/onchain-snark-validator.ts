import { Uint256 } from 'soltypes'
import { challengeCodeToString } from '../code'
import { BlockData, Slash, TxSNARKValidator } from '../types'
import { blockDataToHexString } from '../utils'
import { OnchainValidatorContext } from './onchain-context'

export class OnchainTxSNARKValidator extends OnchainValidatorContext
  implements TxSNARKValidator {
  async validateSNARK(block: BlockData, txIndex: Uint256): Promise<Slash> {
    const tx = this.layer1.validators.snark.methods.validateSNARK(
      blockDataToHexString(block),
      txIndex.toString(),
    )
    const result = await tx.call()
    const slash: Slash = {
      slashable: result.slash,
      reason: challengeCodeToString(result.reason),
    }
    return slash
  }
}
