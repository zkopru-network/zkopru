import { soliditySha3 } from 'web3-utils'
import * as circomlib from 'circomlib'
import { Field } from '@zkopru/babyjubjub'
import { hexify } from '@zkopru/utils'
import BN from 'bn.js'

export interface Hasher<T extends Field | BN> {
  parentOf(left: T, right: T): T
  preHash: T[]
}

function getPreHash<T extends Field | BN>(
  zero: T,
  parentOf: (left: T, right: T) => T,
  depth: number,
): T[] {
  const preHash: T[] = []
  preHash.push(zero)
  for (let level = 0; level < depth - 1; level += 1) {
    const topValue = preHash[preHash.length - 1]
    preHash.push(parentOf(topValue, topValue))
  }
  return preHash
}

export function genesisRoot<T extends Field | BN>(hasher: Hasher<T>): T {
  const lastSib = hasher.preHash.slice(-1)[0]
  return hasher.parentOf(lastSib, lastSib)
}

export function keccakHasher(depth: number): Hasher<BN> {
  const parentOf = (left: BN, right: BN) => {
    const val = soliditySha3(hexify(left, 32), hexify(right, 32)) || '0x'
    return new BN(val.substr(2), 16)
  }
  const preHash = getPreHash<BN>(new BN(0), parentOf, depth)
  return { parentOf, preHash }
}

export function poseidonHasher(depth: number): Hasher<Field> {
  const poseidonHash = circomlib.poseidon.createHash(3, 8, 57)
  const parentOf = (left: Field, right: Field) => {
    return Field.from(
      poseidonHash([left.toIden3BigInt(), right.toIden3BigInt()]).toString(),
    )
  }
  const preHash = getPreHash(Field.zero, parentOf, depth)
  return { parentOf, preHash }
}
