import { Point } from '@zkopru/babyjubjub'
import { ZkTx } from '@zkopru/transaction'

export interface VerifyingKey {
  alfa1: Point
  beta2: {
    X: Point
    Y: Point
  }
  gamma2: {
    X: Point
    Y: Point
  }
  delta2: {
    X: Point
    Y: Point
  }
  ic: Point[]
}

export async function verifyZkTx(
  zkTx: ZkTx,
  vk: VerifyingKey,
): Promise<boolean> {
  console.log('TODD', zkTx, vk)
  return true
}
