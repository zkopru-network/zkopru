import assert from 'assert'
import BN from 'bn.js'
import { Bytes32 } from 'soltypes'
import { soliditySha3Raw } from 'web3-utils'
import { Hasher } from '../hasher'

// BNhis BNS code corresponds to the SMBN.sol code file

export const EXISBN = Bytes32.from(soliditySha3Raw('exist')).toBN()
export const NON_EXISBN = Bytes32.from(soliditySha3Raw(0)).toBN()
assert(
  Bytes32.from(
    '0xb0b4e07bb5592f3d3821b2c1331b436763d7be555cf452d6c6836f74d5201e85',
  )
    .toBN()
    .eq(EXISBN),
  'EXISBN should be same with the hardcoded value in solidity',
)
assert(
  Bytes32.from(
    '0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563',
  )
    .toBN()
    .eq(NON_EXISBN),
  'NON_EXISBN should be same with the hardcoded value in solidity',
)

export function calculateRoot(
  hasher: Hasher<BN>,
  leaf: BN,
  value: BN,
  siblings: BN[],
): BN {
  assert(
    siblings.length === hasher.preHash.length - 1,
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
  return new BN(cursor)
}

export function merkleProof(
  hasher: Hasher<BN>,
  root: BN,
  leaf: BN,
  value: BN,
  siblings: BN[],
): boolean {
  const calculatedRoot = calculateRoot(hasher, leaf, value, siblings)
  return root.eq(calculatedRoot)
}

export function inclusionProof(
  hasher: Hasher<BN>,
  root: BN,
  leaf: BN,
  siblings: BN[],
): boolean {
  return merkleProof(hasher, root, leaf, EXISBN as BN, siblings)
}

export function nonInclusionProof(
  hasher: Hasher<BN>,
  root: BN,
  leaf: BN,
  siblings: BN[],
): boolean {
  return merkleProof(hasher, root, leaf, NON_EXISBN as BN, siblings)
}

export function fill(
  hasher: Hasher<BN>,
  prevRoot: BN,
  leaf: BN,
  siblings: BN[],
): BN {
  assert(nonInclusionProof(hasher, prevRoot, leaf, siblings), 'Already filled')
  const nextRoot = calculateRoot(hasher, leaf, EXISBN as BN, siblings)
  assert(!nextRoot.eq(prevRoot), 'Already filled leaf')
  return nextRoot
}

export function batchFill(
  hasher: Hasher<BN>,
  prevRoot: BN,
  leaves: BN[],
  siblings: BN[][],
): BN {
  assert(leaves.length === siblings.length)
  let root: BN = prevRoot
  for (let i = 0; i < leaves.length; i += 1) {
    root = fill(hasher, root, leaves[i], siblings[i])
  }
  return root
}
