import {
  append,
  merkleProof as mtMerkleProof,
  merkleRoot,
} from './merkle-tree-sol'
import {
  fill,
  batchFill,
  nonInclusionProof,
  inclusionProof,
  merkleProof as smtMerkleProof,
  calculateRoot,
} from './smt-sol'

export const MerkleTree = {
  append,
  merkleProof: mtMerkleProof,
  merkleRoot,
}

export const SMT = {
  fill,
  batchFill,
  inclusionProof,
  nonInclusionProof,
  merkleProof: smtMerkleProof,
  calculateRoot,
}
