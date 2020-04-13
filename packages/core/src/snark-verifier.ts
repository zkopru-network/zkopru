import { fork, ChildProcess } from 'child_process'
import { ZkTx } from '@zkopru/transaction'
import { verifyingKeyIdentifier } from '@zkopru/utils'
import { VerifyingKey } from './snark'

export class SNARKVerifier {
  vks: {
    [txType: string]: VerifyingKey
  }

  constructor(vks?: { [txType: string]: VerifyingKey }) {
    this.vks = vks || {}
  }

  async verifyTx(tx: ZkTx): Promise<boolean> {
    return new Promise<boolean>(res => {
      const vk = this.vks[
        verifyingKeyIdentifier(tx.inflow.length, tx.outflow.length)
      ]
      if (!vk) {
        res(false)
        return
      }
      const process = fork('./snark-child-process.ts')
      process.on('message', message => {
        const { result } = message as { result: boolean }
        res(result)
      })
      process.send({ tx, vk })
    })
  }

  async verifyTxs(txs: ZkTx[]): Promise<{ result: boolean; index?: number }> {
    return new Promise<{ result: boolean; index?: number }>(res => {
      // 1. check vk existence
      for (let index = 0; index < txs.length; index += 1) {
        const tx = txs[index]
        const vk = this.vks[
          verifyingKeyIdentifier(tx.inflow.length, tx.outflow.length)
        ]
        if (!vk) {
          res({ result: false, index })
          return
        }
      }
      const prepared: ChildProcess[] = []
      const used: ChildProcess[] = []
      const success: boolean[] = []
      // prepare processes and attach listeners

      for (let index = 0; index < txs.length; index += 1) {
        const process = fork('./snark-child-process.ts')
        prepared.push(process)
        process.on('message', message => {
          const { result } = message as { result: boolean }
          if (!result) {
            res({ result, index })
            const killProc = (process: ChildProcess) => {
              if (!process.killed) {
                process.kill()
              }
            }
            prepared.forEach(killProc)
            used.forEach(killProc)
          } else {
            success.push(true)
            if (success.length === txs.length) {
              res({ result: true })
            }
          }
        })
      }
      // execute child process to compute snark verification
      for (let index = 0; index < txs.length; index += 1) {
        const tx = txs[index]
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
