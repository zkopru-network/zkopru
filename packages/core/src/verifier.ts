import { verifyingKeyIdentifier } from '@zkopru/utils'
// import { Point } from '@zkopru/babyjubjub'
import { Block, Header } from './block'
import { VerifyingKey } from './snark'
import { ChallengeCode } from './challenge'
import { L1Contract } from './layer1'
import { L2Chain } from './layer2'
import { TransactionObject } from '~contracts/contracts/types'
import { SNARKVerifier } from './snark-verifier'

export interface VerifyOption {
  header: boolean
  deposit: boolean
  migration: boolean
  outputRollUp: boolean
  withdrawalRollUp: boolean
  nullifierRollUp: boolean // Only for FULL NODE
  snark: boolean
}

export enum VerifyResult {
  INVALIDATED,
  PARTIALLY_VERIFIED,
  FULLY_VERIFIED,
}

export class Verifier {
  option: VerifyOption

  snarkVerifier: SNARKVerifier

  constructor(option: VerifyOption, vks?: { [txType: string]: VerifyingKey }) {
    this.option = option
    this.snarkVerifier = new SNARKVerifier(vks)
  }

  addVerifyingKey(nI: number, nO: number, vk: VerifyingKey) {
    this.snarkVerifier.vks[verifyingKeyIdentifier(nI, nO)] = vk
  }

  async verify({
    layer1,
    layer2,
    prevHeader,
    block,
  }: {
    layer1: L1Contract
    layer2: L2Chain
    prevHeader: Header
    block: Block
  }): Promise<{ result: VerifyResult; challenge?: TransactionObject<void> }> {
    if (this.option.header) {
      const headerChallenge = await this.verifyHeader(block)
      if (headerChallenge) {
        if (!block.txData) throw Error('Not available to the tx data')
        return {
          result: VerifyResult.INVALIDATED,
          challenge: layer1.challenger.header.methods.challengeDepositRoot(
            block.txData.input,
          ),
        }
      }
    }
    // implement every challenge logics here
    console.log(this, layer1, layer2, block, this.option, prevHeader)
    const verificationResult = true
    const fullVerification = Object.values(this.option).reduce(
      (prev, curr) => (prev ? curr : prev),
      true,
    )
    let result: VerifyResult | undefined
    if (verificationResult) {
      result = fullVerification
        ? VerifyResult.FULLY_VERIFIED
        : VerifyResult.PARTIALLY_VERIFIED
    } else {
      result = VerifyResult.INVALIDATED
    }
    return { result }
  }

  async verifyHeader(block: Block): Promise<ChallengeCode | null> {
    console.log(block, this)
    // onChallenge({ block })
    return ChallengeCode.INVALID_SNARK
  }

  async verifyTxs(block: Block): Promise<{ result: boolean; index?: number }> {
    // todo 1. snark test
    const { result, index } = await this.snarkVerifier.verifyTxs(block.body.txs)
    // todo 2. inclusion reference check
    // todo 3. overflow check(solidity support required)
    // todo 4. double spending check
    // todo 5. doubled nullifier test
    // todo 6. atomic swap test
    // todo: onChallenge()
    return { result, index }
  }
}
