import { fork, ChildProcess } from 'child_process'
import { ZkTx } from '@zkopru/transaction'
import { logger } from '@zkopru/utils'
import { join } from 'path'
import assert from 'assert'
import * as ffjs from 'ffjavascript'
import * as snarkjs from 'snarkjs'
import { BigNumber } from 'ethers'

export interface VerifyingKey {
  protocol: string
  nPublic: number
  curve: string
  vk_alpha_1: BigInt[]
  vk_beta_2: BigInt[][]
  vk_gamma_2: BigInt[][]
  vk_delta_2: BigInt[][]
  vk_alphabeta_12: BigInt
  IC: BigInt[][]
}

export function verifyingKeyIdentifier(nI: number, nO: number): string {
  assert(nI < 256, 'nI is a 8 bit value')
  assert(nO < 256, 'nI is a 8 bit value')
  return BigNumber.from(nI)
    .shl(128)
    .add(nO)
    .toString()
}

export class SNARKVerifier {
  vks: {
    [txType: string]: VerifyingKey
  }

  constructor(vks?: { [txType: string]: VerifyingKey }) {
    this.vks = vks || {}
  }

  hasVK(inflowLen: number, outflowLen: number): boolean {
    const registeredVk = this.vks[verifyingKeyIdentifier(inflowLen, outflowLen)]
    return !!registeredVk
  }

  addVerifyingKey(nI: number, nO: number, vk: VerifyingKey) {
    this.vks[verifyingKeyIdentifier(nI, nO)] = vk
  }

  async verifyTx(tx: ZkTx): Promise<boolean> {
    // run in main process if in browser
    // TODO: use webworker
    if (typeof window !== 'undefined') {
      const registeredVk = this.vks[
        verifyingKeyIdentifier(tx.inflow.length, tx.outflow.length)
      ]
      const proof = ffjs.utils.stringifyBigInts(tx.circomProof())
      const signals = ffjs.utils.stringifyBigInts(tx.signals())
      const vk = ffjs.utils.stringifyBigInts(registeredVk)
      let result!: boolean
      try {
        result = await snarkjs.groth16.verify(vk, signals, proof)
      } catch (e) {
        logger.error(e as any)
        result = false
      }
      return result
    }
    return new Promise<boolean>(res => {
      const registeredVk = this.vks[
        verifyingKeyIdentifier(tx.inflow.length, tx.outflow.length)
      ]
      /**
      logger.trace(
        `core/snark-verifier: verifying key: ${JSON.stringify(
          registeredVk,
          (_, v) => (typeof v === 'bigint' ? v.toString() : v),
        )}`,
      )
      */
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
        logger.info(
          `core/snark-verifier.ts - verifyTx(${tx
            .hash()
            .toString()}) => ${JSON.stringify(result)}`,
        )
        res(result)
        process.kill()
      })

      const proof = ffjs.utils.stringifyBigInts(tx.circomProof())
      const signals = ffjs.utils.stringifyBigInts(tx.signals())
      const vk = ffjs.utils.stringifyBigInts(registeredVk)
      process.send({ vk, proof, signals })
    })
  }

  async verifyTxs(txs: ZkTx[]): Promise<{ result: boolean; index?: number }> {
    if (typeof window !== 'undefined') {
      for (const [index, tx] of Object.entries(txs)) {
        const result = await this.verifyTx(tx)
        if (!result) return Promise.resolve({ result: false, index: +index })
      }
      return Promise.resolve({ result: true })
    }
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
