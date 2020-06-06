import { verifyingKeyIdentifier, logger } from '@zkopru/utils'
import { Deposit as DepositSql } from '@zkopru/prisma'
// import { Point } from '@zkopru/babyjubjub'
import { Bytes32, Uint256 } from 'soltypes'
import { soliditySha3 } from 'web3-utils'
import BN from 'bn.js'
import { Block, Header, VerifyResult } from './block'
import { VerifyingKey } from './snark'
import { L1Contract } from './layer1'
import { SNARKVerifier } from './snark-verifier'
import { L2Chain, Patch } from './layer2'

export interface VerifyOption {
  header: boolean
  deposit: boolean
  migration: boolean
  outputRollUp: boolean
  withdrawalRollUp: boolean
  nullifierRollUp: boolean // Only for FULL NODE
  snark: boolean
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

  async verifyBlock({
    layer1,
    layer2,
    prevHeader,
    block,
  }: {
    layer1: L1Contract
    layer2: L2Chain
    prevHeader: Header
    block: Block
  }): Promise<Patch> {
    logger.info(`Verifying ${block.hash}`)
    if (this.option.header) {
      await this.verifyHeader(block)
    }
    // implement every challenge logics here
    // deposit verification
    for (const massDeposit of block.body.massDeposits) {
      const deposits: DepositSql[] = await layer2.getDeposits(massDeposit)
      console.log('massdeposit...', massDeposit)
      console.log('deposits...', deposits)
      let merged
      let fee = new BN(0)
      for (const deposit of deposits) {
        merged = soliditySha3(merged || 0, deposit.note) || ''
        fee = fee.add(Uint256.from(deposit.fee).toBN())
      }
      console.log('computed merged', merged)
      console.log('committed merged', massDeposit.merged)
      console.log('deposits', deposits)
      if (
        !Bytes32.from(merged).eq(massDeposit.merged) ||
        !massDeposit.fee.toBN().eq(fee)
      ) {
        throw Error('Failed to match the deposit leaves with the proposal.')
      }
    }

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
    // TODO return other patches here
    return { result, block: block.hash }
  }

  async verifyHeader(block: Block) {
    console.log(block, this)
    // onChallenge({ block })
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
