import { Uint256 } from 'soltypes'
import { VerifyingKey } from '@zkopru/utils'
import { L2Chain } from '../../context/layer2'
import { BlockData, Slash, TxSNARKValidator } from '../types'
import { SNARKVerifier } from '../../snark/snark-verifier'
import { blockDataToBlock } from '../utils'
import { OffchainValidatorContext } from './offchain-context'
import { CODE } from '../code'

export class OffchainTxSNARKValidator extends OffchainValidatorContext
  implements TxSNARKValidator {
  snarkVerifier: SNARKVerifier

  constructor(layer2: L2Chain, vks?: { [txType: string]: VerifyingKey }) {
    super(layer2)
    this.snarkVerifier = new SNARKVerifier(vks)
  }

  async validateSNARK(data: BlockData, txIndex: Uint256): Promise<Slash> {
    const block = blockDataToBlock(data)
    const tx = block.body.txs[txIndex.toBN().toNumber()]
    let slash: Slash
    if (!this.snarkVerifier.hasVK(tx.inflow.length, tx.outflow.length)) {
      slash = {
        slashable: true,
        reason: CODE.S1,
      }
    } else {
      const verified = await this.snarkVerifier.verifyTx(tx)
      slash = {
        slashable: !verified,
        reason: CODE.S2,
      }
    }
    return slash
  }
}
