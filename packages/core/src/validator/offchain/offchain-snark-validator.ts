import { Uint256 } from 'soltypes'
import { BlockData, Validation, TxSNARKValidator } from '../types'
import { blockDataToBlock } from '../utils'
import { OffchainValidatorContext } from './offchain-context'
import { CODE } from '../code'

export class OffchainTxSNARKValidator extends OffchainValidatorContext
  implements TxSNARKValidator {
  async validateSNARK(data: BlockData, txIndex: Uint256): Promise<Validation> {
    const block = blockDataToBlock(data)
    const tx = block.body.txs[txIndex.toBN().toNumber()]
    let slash: Validation
    if (!this.layer2.snarkVerifier.hasVK(tx.inflow.length, tx.outflow.length)) {
      slash = {
        slashable: true,
        reason: CODE.S1,
      }
    } else {
      const verified = await this.layer2.snarkVerifier.verifyTx(tx)
      slash = {
        slashable: !verified,
        reason: CODE.S2,
      }
    }
    return slash
  }
}
