import assert from 'assert'
import { BigNumber, ethers } from 'ethers'
import { Hasher } from '../hasher'

// This TS code corresponds to the SMT.sol code file

export const EXIST: BigNumber = BigNumber.from(
  ethers.utils.keccak256(ethers.utils.toUtf8Bytes('exist')),
)
export const NON_EXIST: BigNumber = BigNumber.from(
  ethers.utils.keccak256(ethers.constants.HashZero),
)
assert(
  BigNumber.from(
    '0xb0b4e07bb5592f3d3821b2c1331b436763d7be555cf452d6c6836f74d5201e85')
    .eq(EXIST),
  'EXISBN should be same with the hardcoded value in solidity',
)
assert(
  BigNumber.from(
    '0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563')
    .eq(NON_EXIST),
  'NON_EXISBN should be same with the hardcoded value in solidity',
)

export function calculateRoot<T extends BigNumber>(
  hasher: Hasher<T>,
  leaf: T,
  value: T,
  siblings: T[],
): T {
  assert(
    siblings.length === hasher.preHash.length - 1,
    'Invalid length of siblings',
  )
  let cursor = value
  const path = BigNumber.from(leaf)
  for (let i = 0; i < siblings.length; i += 1) {
    if (
      path
        .shr(i)
        .and(1)
        .isZero()
    ) {
      // Right sibling
      cursor = hasher.parentOf(cursor, siblings[i])
    } else {
      // Left sibling
      cursor = hasher.parentOf(siblings[i], cursor)
    }
  }
  return cursor
}

export function merkleProof(
  hasher: Hasher<BigNumber>,
  root: BigNumber,
  leaf: BigNumber,
  value: BigNumber,
  siblings: BigNumber[],
): boolean {
  const calculatedRoot = calculateRoot(hasher, leaf, value, siblings)
  return BigNumber.from(root).eq(calculatedRoot)
}

export function inclusionProof(
  hasher: Hasher<BigNumber>,
  root: BigNumber,
  leaf: BigNumber,
  siblings: BigNumber[],
): boolean {
  return merkleProof(hasher, root, leaf, EXIST, siblings)
}

export function nonInclusionProof(
  hasher: Hasher<BigNumber>,
  root: BigNumber,
  leaf: BigNumber,
  siblings: BigNumber[],
): boolean {
  return merkleProof(hasher, root, leaf, NON_EXIST, siblings)
}

export function fill<T extends BigNumber>(
  hasher: Hasher<T>,
  prevRoot: T,
  leaf: T,
  siblings: T[],
): T {
  assert(nonInclusionProof(hasher, prevRoot, leaf, siblings), 'Already filled')
  const nextRoot = calculateRoot(hasher, leaf, EXIST as T, siblings)
  assert(!BigNumber.from(nextRoot).eq(prevRoot), 'Already filled leaf')
  return nextRoot
}

export function batchFill<T extends BigNumber>(
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
