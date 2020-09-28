import { fork, ChildProcess } from 'child_process'
import { ZkTx } from '@zkopru/transaction'
import { VerifyingKey, verifyingKeyIdentifier, logger } from '@zkopru/utils'
import { join } from 'path'
import * as ffjs from 'ffjavascript'

export class SNARKVerifier {
  vks: {
    [txType: string]: VerifyingKey
  }

  constructor(vks?: { [txType: string]: VerifyingKey }) {
    this.vks = vks || {}
  }

  async verifyTx(tx: ZkTx): Promise<boolean> {
    return new Promise<boolean>(res => {
      const registeredVk = this.vks[
        verifyingKeyIdentifier(tx.inflow.length, tx.outflow.length)
      ]
      if (!registeredVk) {
        res(false)
        return
      }
      const process = fork(join(__dirname, 'snark-child-process.js'), [
        '-r',
        'ts-node/register',
      ])
      // const process = fork('snark-child-process.js')
      process.on('message', message => {
        const { result } = message as { result: boolean }
        logger.info(`snark result: ${result}`)
        res(result)
      })

      const proof = ffjs.utils.stringifyBigInts(tx.circomProof())
      const signals = ffjs.utils.stringifyBigInts(tx.signals())
      const vk = ffjs.utils.stringifyBigInts(registeredVk)
      process.send({ vk, proof, signals })
    })
  }

  async verifyTxs(txs: ZkTx[]): Promise<{ result: boolean; index?: number }> {
    return new Promise<{ result: boolean; index?: number }>(res => {
      // 1. check vk existence
      for (let index = 0; index < txs.length; index += 1) {
        const tx = txs[index]
        const registeredVk = this.vks[
          verifyingKeyIdentifier(tx.inflow.length, tx.outflow.length)
        ]
        if (!registeredVk) {
          res({ result: false, index })
          return
        }
      }
      const prepared: ChildProcess[] = []
      const used: ChildProcess[] = []
      const success: boolean[] = []
      // prepare processes and attach listeners

      for (let index = 0; index < txs.length; index += 1) {
        const process = fork(join(__dirname, 'snark-child-process.js'), [
          '-r',
          'ts-node/register',
        ])
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
        const registeredVk = this.vks[
          verifyingKeyIdentifier(tx.inflow.length, tx.outflow.length)
        ]
        const process = prepared.pop() as ChildProcess
        used.push(process)
        const proof = ffjs.utils.stringifyBigInts(tx.circomProof())
        const signals = ffjs.utils.stringifyBigInts(tx.signals())
        const vk = ffjs.utils.stringifyBigInts(registeredVk)
        process.send({ vk, proof, signals })
      }
    })
  }
}
