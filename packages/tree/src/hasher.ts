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
  const preHash = Array<Field>(depth)
  preHash[0] = Field.zero
  for (let level = 1; level < depth; level += 1) {
    preHash[level] = parentOf(preHash[level - 1], preHash[level - 1])
  }
  return preHash
}

export function genesisRoot(hasher: Hasher): Field {
  const lastSib = hasher.preHash[hasher.preHash.length - 1]
  return hasher.parentOf(lastSib, lastSib)
}

export function keccakHasher(depth: number): Hasher {
  const parentOf = (left: Field, right: Field) => {
    return Field.from(soliditySha3(left.toString(), right.toString()) || '')
  }
  const preHash = getPreHash(parentOf, depth)
  return { parentOf, preHash }
}

export function poseidonHasher(depth: number): Hasher {
  const poseidonHash = circomlib.poseidon.createHash(3, 8, 57)
  const parentOf = (left: Field, right: Field) => {
    return Field.from(
      poseidonHash([left.toIden3BigInt(), right.toIden3BigInt()]).toString(),
    )
  }
  const preHash = getPreHash(parentOf, depth)
  return { parentOf, preHash }
}
