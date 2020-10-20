import { Field } from '@zkopru/babyjubjub'
import assert from 'assert'
import BN from 'bn.js'
import { Hasher } from '../hasher'

// This TS code corresponds to the MerkleTree.sol code file

function appendLeaf<T extends Field | BN>(
  hasher: Hasher<T>,
  index: T,
  leaf: T,
  siblings: T[],
): {
  nextRoot: T
  nextIndex: T
  nextSiblings: T[]
} {
  assert(siblings.length === hasher.preHash.length, 'Invalid sibling length')
  const nextSiblings = [...siblings]
  const path = index
  let node: T = leaf
  for (let level = 0; level < siblings.length; level += 1) {
    if (path.shrn(level).isEven()) {
      // Right empty sibling
      nextSiblings[level] = node // current node becomes the next merkle proof's left sibling
      node = hasher.parentOf(node, hasher.preHash[level])
    } else {
      // Left sibling
      nextSiblings[level] = siblings[level] // keep current sibling
      node = hasher.parentOf(siblings[level], node)
    }
  }
  const nextRoot = node
  const nextIndex = index.addn(1) as T
  return {
    nextRoot,
    nextIndex,
    nextSiblings,
  }
}

function startingLeafProof<T extends Field | BN>(
  hasher: Hasher<T>,
  root: T,
  index: T,
  siblings: T[],
): boolean {
  assert(siblings.length === hasher.preHash.length, 'Invalid sibling length')
  const path = index
  let node: T = hasher.preHash[0]
  for (let level = 0; level < siblings.length; level += 1) {
    if (path.shrn(level).isEven()) {
      // Right sibling should be the prehashed zero
      if (!siblings[level].eq(hasher.preHash[level])) return false
      node = hasher.parentOf(node, hasher.preHash[level])
    } else {
      // Left sibling should not be a prehahsed zero
      if (siblings[level].eq(hasher.preHash[level])) return false
      node = hasher.parentOf(siblings[level], node)
    }
  }
  return root.eq(node)
}

export function merkleRoot<T extends Field | BN>(
  hasher: Hasher<T>,
  leaf: T,
  index: T,
  siblings: T[],
): T {
  assert(siblings.length === hasher.preHash.length, 'Invalid sibling length')
  const path = index
  let node: T = leaf
  for (let level = 0; level < siblings.length; level += 1) {
    if (path.shrn(level).isEven()) {
      // Right sibling
      node = hasher.parentOf(node, siblings[level])
    } else {
      // Left sibling
      node = hasher.parentOf(siblings[level], node)
    }
  }
  return node
}

export function merkleProof<T extends Field | BN>(
  hasher: Hasher<T>,
  root: T,
  leaf: T,
  index: T,
  siblings: T[],
): boolean {
  return merkleRoot(hasher, leaf, index, siblings).eq(root)
}

export function append<T extends Field | BN>(
  hasher: Hasher<T>,
  startingRoot: T,
  index: T,
  leaves: T[],
  initialSiblings: T[],
): T {
  assert(
    startingLeafProof(hasher, startingRoot, index, initialSiblings),
    'Invalid merkle proof of starting leaf node',
  )
  let nextRoot = startingRoot
  let nextIndex = index
  let nextSiblings = [...initialSiblings]
  for (let i = 0; i < leaves.length; i += 1) {
    const updated = appendLeaf(hasher, nextIndex, leaves[i], nextSiblings)
    nextRoot = updated.nextRoot
    nextIndex = updated.nextIndex
    nextSiblings = updated.nextSiblings
  }
  return nextRoot
}
