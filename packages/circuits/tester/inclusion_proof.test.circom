include "../lib/inclusion_proof.circom";

template InclusionProofTest(depth) {
  // Signal definitions
  signal input root;
  signal input leaf;
  signal input path;
  signal input siblings[depth];
  signal output result;
  component proof = InclusionProof(depth);

  proof.root <== root;
  proof.leaf <== leaf;
  proof.path <== path;
  for (var level = 0; level < depth; level++) {
    proof.siblings[level] <== siblings[level];
  }
  result <== 1;
}

component main = InclusionProofTest(3);
