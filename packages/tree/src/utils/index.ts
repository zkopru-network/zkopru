import {
  append,
  merkleProof as mtMerkleProof,
  merkleRoot,
  appendAsSubTrees,
  splitToSubTrees,
} from './merkle-tree-sol'
import {
  fill,
  batchFill,
  nonInclusionProof,
  inclusionProof,
  merkleProof as smtMerkleProof,
  calculateRoot,
} from './smt-sol'

export const MerkleTreeLib = {
  append,
  merkleProof: mtMerkleProof,
  merkleRoot,
}

export const SubTreeLib = {
  appendAsSubTrees,
  splitToSubTrees,
}

export const SMT = {
  fill,
  batchFill,
  inclusionProof,
  nonInclusionProof,
  merkleProof: smtMerkleProof,
  calculateRoot,
}
