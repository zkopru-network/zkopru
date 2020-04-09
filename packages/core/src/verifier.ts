import { verifyingKeyIdentifier } from '@zkopru/utils'
import { fork, ChildProcess } from 'child_process'
// import { Point } from '@zkopru/babyjubjub'
import { Block } from './block'
import { VerifyingKey } from './snark'
import { ChallengeCode } from './challenge'

export class Verifier {
  vks: {
    [txType: string]: VerifyingKey
  }

  constructor(vks?: { [txType: string]: VerifyingKey }) {
    this.vks = vks || {}
  }

  addVerifyingKey(nI: number, nO: number, vk: VerifyingKey) {
    this.vks[verifyingKeyIdentifier(nI, nO)] = vk
  }

  async verify(
    block: Block,
  ): Promise<{ result: boolean; code?: ChallengeCode }> {
    return new Promise<{ result: boolean; code?: ChallengeCode }>(res => {
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
        res({ result: false, code: ChallengeCode.NOT_SUPPORTED_TYPE })
      }
      // prepare processes and attach listeners
      Array(block.body.txs.length)
        .fill(undefined)
        .forEach(_ => {
          // TODO try forking dirname + js extension later
          const process = fork('./snark_child_process.ts')
          prepared.push(process)
          process.on('message', message => {
            const { result } = message as { result: boolean }
            if (!result) {
              res({ result: false, code: ChallengeCode.INVALID_SNARK })
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
                res({ result: true })
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
