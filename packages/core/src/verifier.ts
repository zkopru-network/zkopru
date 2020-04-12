import { verifyingKeyIdentifier } from '@zkopru/utils'
import { fork, ChildProcess } from 'child_process'
// import { Point } from '@zkopru/babyjubjub'
import { Block, Header } from './block'
import { VerifyingKey } from './snark'
import { ChallengeCode, Challenge } from './challenge'
import { L1Contract } from './layer1'
import { L2Chain } from './layer2'
import { TransactionObject } from '~contracts/contracts/types'

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

  vks: {
    [txType: string]: VerifyingKey
  }

  constructor(option: VerifyOption, vks?: { [txType: string]: VerifyingKey }) {
    this.option = option
    this.vks = vks || {}
  }

  addVerifyingKey(nI: number, nO: number, vk: VerifyingKey) {
    this.vks[verifyingKeyIdentifier(nI, nO)] = vk
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

  async verifyTxs(
    block: Block,
    onChallenge: (challenge: Challenge) => Promise<void>,
  ): Promise<boolean> {
    return new Promise<boolean>(res => {
      const prepared: ChildProcess[] = []
      const used: ChildProcess[] = []
      const success: boolean[] = []
      const allVKsExist = block.body.txs.reduce((vkExist, tx) => {
        if (!vkExist) return vkExist
        const vk = this.vks[
          verifyingKeyIdentifier(tx.inflow.length, tx.outflow.length)
        ]
        if (!vk) {
          return false
        }
        return vkExist
      }, true)
      if (!allVKsExist) {
        onChallenge({ block, code: ChallengeCode.NOT_SUPPORTED_TYPE })
        res(false)
      }
      // prepare processes and attach listeners
      Array(block.body.txs.length)
        .fill(undefined)
        .forEach(_ => {
          // TODO try forking dirname + js extension later
          const process = fork('./snark-child-process.ts')
          prepared.push(process)
          process.on('message', message => {
            const { result } = message as { result: boolean }
            if (!result) {
              onChallenge({ block, code: ChallengeCode.INVALID_SNARK })
              res(false)
              const killProc = (process: ChildProcess) => {
                if (!process.killed) {
                  process.kill()
                }
              }
              prepared.forEach(killProc)
              used.forEach(killProc)
            } else {
              success.push(true)
              if (success.length === block.body.txs.length) {
                res(true)
              }
            }
          })
        })
      // execute child process to compute snark verification
      for (const tx of block.body.txs) {
        const process = prepared.pop() as ChildProcess
        used.push(process)
        const vk = this.vks[
          verifyingKeyIdentifier(tx.inflow.length, tx.outflow.length)
        ]
        process.send({ tx, vk })
      }
    })
  }
}
