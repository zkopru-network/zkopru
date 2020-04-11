import { soliditySha3 } from 'web3-utils'
import * as circomlib from 'circomlib'
import { Field } from '@zkopru/babyjubjub'

export interface Hasher {
  parentOf(left: Field, right: Field): Field
  preHash: Field[]
}

function getPreHash(
  parentOf: (left: Field, right: Field) => Field,
  depth: number,
): Field[] {
  const preHash = Array<Field>(depth + 1)
  preHash[0] = Field.zero
  for (let level = 0; level < depth; level += 1) {
    preHash[level + 1] = parentOf(preHash[level], preHash[level])
  }
  return preHash
}

export function keccakHasher(depth: number): Hasher {
  const parentOf = (left: Field, right: Field) => {
    return Field.from(soliditySha3(left.toString(), right.toString()) || '')
  }
  const preHash = getPreHash(parentOf, depth)
  return { parentOf, preHash }
}

export function poseidonHasher(depth: number): Hasher {
  const poseidonHash = circomlib.poseidon.createHash(3, 8, 57, 'poseidon')
  const parentOf = (left: Field, right: Field) => {
    return Field.from(poseidonHash([left.val, right.val]))
  }
  const preHash = getPreHash(parentOf, depth)
  return { parentOf, preHash }
}
