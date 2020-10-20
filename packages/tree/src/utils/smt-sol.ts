import assert from 'assert'
import { Field } from '@zkopru/babyjubjub'
import BN from 'bn.js'
import { Bytes32 } from 'soltypes'
import { soliditySha3Raw } from 'web3-utils'
import { Hasher } from '../hasher'

// This TS code corresponds to the SMT.sol code file

export const EXIST = Field.from(Bytes32.from(soliditySha3Raw('exist')).toBN())
export const NON_EXIST = Field.from(Bytes32.from(soliditySha3Raw(0)).toBN())
assert(
  Bytes32.from(
    '0xb0b4e07bb5592f3d3821b2c1331b436763d7be555cf452d6c6836f74d5201e85',
  )
    .toBN()
    .eq(EXIST),
)
assert(
  Bytes32.from(
    '0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563',
  )
    .toBN()
    .eq(EXIST),
)

export function calculateRoot<T extends Field | BN>(
  hasher: Hasher<T>,
  leaf: T,
  value: T,
  siblings: T[],
): T {
  assert(
    siblings.length === hasher.preHash.length,
    'Invalid length of siblings',
  )
  let cursor = value
  const path = leaf
  for (let i = 0; i < siblings.length; i += 1) {
    if (path.shrn(i).isEven()) {
      // Right sibling
      cursor = hasher.parentOf(cursor, siblings[i])
    } else {
      // Left sibling
      cursor = hasher.parentOf(siblings[i], cursor)
    }
  }
  if (leaf instanceof Field) {
    return Field.from(cursor) as T
  }
  return new BN(cursor) as T
}

export function merkleProof<T extends Field | BN>(
  hasher: Hasher<T>,
  root: T,
  leaf: T,
  value: T,
  siblings: T[],
): boolean {
  const calculatedRoot = calculateRoot(hasher, leaf, value, siblings)
  return root.eq(calculatedRoot)
}

export function inclusionProof<T extends Field | BN>(
  hasher: Hasher<T>,
  root: T,
  leaf: T,
  siblings: T[],
): boolean {
  return merkleProof(hasher, root, leaf, EXIST as T, siblings)
}

export function nonInclusionProof<T extends Field | BN>(
  hasher: Hasher<T>,
  root: T,
  leaf: T,
  siblings: T[],
): boolean {
  return merkleProof(hasher, root, leaf, NON_EXIST as T, siblings)
}

export function fill<T extends Field | BN>(
  hasher: Hasher<T>,
  prevRoot: T,
  leaf: T,
  siblings: T[],
): T {
  assert(nonInclusionProof(hasher, prevRoot, leaf, siblings), 'Already filled')
  const nextRoot = calculateRoot(hasher, leaf, EXIST as T, siblings)
  assert(!nextRoot.eq(prevRoot), 'Already filled leaf')
  return nextRoot
}

export function batchFill<T extends Field | BN>(
  hasher: Hasher<T>,
  prevRoot: T,
  leaves: T[],
  siblings: T[][],
): T {
  assert(leaves.length === siblings.length)
  let root: T = prevRoot
  for (let i = 0; i < leaves.length; i += 1) {
    root = fill(hasher, root, leaves[i], siblings[i])
  }
  return root
}
