import { hexToBuffer } from '@zkopru/utils'
import * as circomlib from 'circomlib'
import { F } from './types/ff'
import { Fp } from './fp'
import { Point } from './point'

export interface EdDSA {
  R8: Point
  S: Fp
}

export function verifyEdDSA(msg: F, sig: EdDSA, pubKey: Point): boolean {
  const result = circomlib.eddsa.verifyPoseidon(
    Fp.from(msg).toBigInt(),
    {
      R8: [sig.R8.x.toBigInt(), sig.R8.y.toBigInt()],
      S: sig.S.toBigInt(),
    },
    [pubKey.x.toBigInt(), pubKey.y.toBigInt()],
  )
  return result
}

export function signEdDSA({
  msg,
  privKey,
}: {
  msg: F
  privKey: Buffer | string
}): EdDSA {
  const buff: Buffer =
    typeof privKey === 'string' ? hexToBuffer(privKey) : privKey
  const result = circomlib.eddsa.signPoseidon(buff, Fp.from(msg).toBigInt())
  return {
    R8: Point.from(result.R8[0].toString(), result.R8[1].toString()),
    S: Fp.from(result.S.toString()),
  }
}
