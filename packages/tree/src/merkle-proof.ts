import { Field } from '@zkopru/babyjubjub'
import { Hasher } from './hasher'

export interface MerkleProof {
  root: Field
  index: Field
  leaf: Field
  siblings: Field[]
}

export function verifyProof(hasher: Hasher, proof: MerkleProof): boolean {
  let path = proof.index
  let node = proof.leaf
  for (let i = 0; i < proof.siblings.length; i += 1) {
    if (path.isEven()) {
      // right sibling
      node = hasher.parentOf(node, proof.siblings[i])
    } else {
      // left sibling
      node = hasher.parentOf(proof.siblings[i], node)
    }
    path = path.shrn(1)
  }
  return node.eq(proof.root)
}

export function startingLeafProof(
  hasher: Hasher,
  root: Field,
  index: Field,
  siblings: Field[],
): boolean {
  const depth = siblings.length
  // calculate the siblings validity
  let path = index
  for (let i = 0; i < depth; i += 1) {
    if (path.isEven()) {
      // Right sibling should be a prehashed zero
      if (!siblings[i].eq(hasher.preHash[i])) return false
    } else {
      // Left sibling should not be a prehashed zero
      // eslint-disable-next-line no-lonely-if
      if (siblings[i].eq(hasher.preHash[i])) return false
    }
    path = path.shrn(1)
  }
  return verifyProof(hasher, { root, index, leaf: hasher.preHash[0], siblings })
}
