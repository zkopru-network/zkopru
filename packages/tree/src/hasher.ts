import { poseidon } from 'circomlib'
import { Fp } from '@zkopru/babyjubjub'
import { BigNumber, BigNumberish } from 'ethers'
import { solidityKeccak256 } from 'ethers/lib/utils'

export interface Hasher<T extends BigNumberish> {
  parentOf(left: T, right: T): T
  preHash: T[]
}

function getPreHash<T extends BigNumberish>(
  zero: T,
  parentOf: (left: T, right: T) => T,
  depth: number,
): T[] {
  const preHash: T[] = []
  preHash.push(zero)
  for (let level = 0; level < depth; level += 1) {
    const topValue = preHash[preHash.length - 1]
    preHash.push(parentOf(topValue, topValue))
  }
  return preHash
}

export function genesisRoot<T extends BigNumberish>(hasher: Hasher<T>): T {
  return hasher.preHash.slice(-1)[0]
}

export function keccakHasher(depth: number): Hasher<BigNumber> {
  const parentOf = (left: BigNumber, right: BigNumber) => {
    const val = solidityKeccak256(['uint256', 'uint256'], [left, right])
    return BigNumber.from(val)
  }
  const preHash = getPreHash<BigNumber>(BigNumber.from(0), parentOf, depth)
  return { parentOf, preHash }
}

export function poseidonHasher(depth: number): Hasher<Fp> {
  const parentOf = (left: Fp, right: Fp) => {
    return Fp.from(poseidon([left.toBigInt(), right.toBigInt()]).toString())
  }
  const preHash = getPreHash(Fp.zero, parentOf, depth)
  return { parentOf, preHash }
}
