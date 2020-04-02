import { Field } from '@zkopru/commons'
import { soliditySha3 } from 'web3-utils'
import * as circomlib from 'circomlib'

export interface Hasher {
  parentOf(left: Field, right: Field): Field
  preHash: Field[]
}

export function keccakHasher(depth: number): Hasher {
  const parentOf = (left: Field, right: Field) => {
    return Field.from(soliditySha3(left.toString(), right.toString()) || '')
  }
  const preHash = Array<Field>(depth)
  preHash[0] = Field.zero
  for (let level = 1; level < depth; level += 1) {
    preHash[level] = parentOf(preHash[level - 1], preHash[level - 1])
  }
  return { parentOf, preHash }
}

export function poseidonHasher(depth: number): Hasher {
  const poseidonHash = circomlib.poseidon.createHash(6, 8, 57, 'poseidon')
  const parentOf = (left: Field, right: Field) => {
    return Field.from(poseidonHash([left.val, right.val]))
  }
  const preHash = Array<Field>(depth)
  preHash[0] = Field.zero
  for (let level = 1; level < depth; level += 1) {
    preHash[level] = parentOf(preHash[level - 1], preHash[level - 1])
  }
  return { parentOf, preHash }
}
