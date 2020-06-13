import { verifyingKeyIdentifier, logger, root } from '@zkopru/utils'
import { Deposit as DepositSql } from '@zkopru/prisma'
// import { Point } from '@zkopru/babyjubjub'
import { Bytes32, Uint256 } from 'soltypes'
import { soliditySha3 } from 'web3-utils'
import BN from 'bn.js'
import { DryPatchResult } from '@zkopru/tree'
import {
  Block,
  Header,
  VerifyResult,
  headerHash,
  massDepositHash,
  massMigrationHash,
} from './block'
import { VerifyingKey } from './snark'
import { SNARKVerifier } from './snark-verifier'
import { L2Chain, Patch } from './layer2'
import { Challenge, ChallengeCode } from './challenge'

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
    layer2,
    prevHeader,
    block,
  }: {
    layer2: L2Chain
    prevHeader: Header
    block: Block
  }): Promise<{ patch?: Patch; challenge?: Challenge }> {
    logger.info(`Verifying ${block.hash}`)
    // check current node status is equal to the prev header
    if (!headerHash(prevHeader).eq(block.header.parentBlock))
      throw Error('differnet parent hash')
    const snapShot = await layer2.grove.getSnapshot()
    switch (true) {
      case !prevHeader.utxoIndex.toBN().eq(snapShot.utxoTreeIndex):
      case !prevHeader.utxoRoot.toBN().eq(snapShot.utxoTreeRoot):
      case !prevHeader.withdrawalIndex.toBN().eq(snapShot.withdrawalTreeIndex):
      case !prevHeader.withdrawalRoot.toBN().eq(snapShot.withdrawalTreeRoot):
      case !snapShot.nullifierTreeRoot?.eq(prevHeader.nullifierRoot.toBN()):
        throw Error('Current grove does not fit for prev header')
      default:
        break
    }
    // verify and gen challenge codes here
    const treePatch = await layer2.getGrovePatch(block)
    const dryPatchResult = await layer2.grove.dryPatch(treePatch)
    if (this.option.header) {
      const code = Verifier.verifyHeader(block, dryPatchResult)
      if (code) {
        return { challenge: { code } }
      }
    }
    // deposit verification
    for (let i = 0; i < block.body.massDeposits.length; i += 1) {
      const massDeposit = block.body.massDeposits[i]
      const deposits: DepositSql[] = await layer2.getDeposits(massDeposit)
      let merged
      let fee = new BN(0)
      for (const deposit of deposits) {
        merged = soliditySha3(merged || 0, deposit.note) || ''
        fee = fee.add(Uint256.from(deposit.fee).toBN())
      }
      if (
        !Bytes32.from(merged).eq(massDeposit.merged) ||
        !massDeposit.fee.toBN().eq(fee)
      ) {
        return {
          challenge: { code: 'challengeMassDeposit', data: { index: i } },
        }
      }
    }
    // migration verification
    // tx verification

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
    return {
      patch: {
        result,
        block: block.hash,
        massDeposits: block.body.massDeposits.map(massDepositHash),
        treePatch,
      },
    }
  }

  static verifyHeader(
    block: Block,
    patchResult: DryPatchResult,
  ): ChallengeCode | undefined {
    const depositFee = block.body.massDeposits.reduce(
      (acc, md) => acc.add(md.fee.toBN()),
      new BN(0),
    )
    const migrationFee = block.body.massMigrations.reduce(
      (acc, mm) => acc.add(mm.migratingLeaves.fee.toBN()),
      new BN(0),
    )
    const txFee = block.body.txs.reduce((acc, tx) => acc.add(tx.fee), new BN(0))
    const totalFee = depositFee.add(migrationFee).add(txFee)

    switch (true) {
      case !totalFee.eq(block.header.fee.toBN()):
        return 'challengeTotalFee'
      case !block.header.utxoIndex.toBN().eq(patchResult.utxoTreeIndex):
      case !block.header.utxoRoot.toBN().eq(patchResult.utxoTreeRoot):
        return 'challengeUTXORollUp'
      case !block.header.withdrawalIndex
        .toBN()
        .eq(patchResult.withdrawalTreeIndex):
      case !block.header.withdrawalRoot
        .toBN()
        .eq(patchResult.withdrawalTreeRoot):
        return 'challengeWithdrawalRollUp'
      case !patchResult.nullifierTreeRoot?.eq(
        block.header.nullifierRoot.toBN(),
      ):
        return 'challengeNullifierRollUp'
      case root(block.body.massDeposits.map(massDepositHash)).eq(
        block.header.depositRoot,
      ):
        return 'challengeDepositRoot'
      case root(block.body.massMigrations.map(massMigrationHash)).eq(
        block.header.migrationRoot,
      ):
        return 'challengeMigrationRoot'
      case root(block.body.txs.map(tx => tx.hash())).eq(
        block.header.migrationRoot,
      ):
        return 'challengeTxRoot'
      default:
        return undefined
    }
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
