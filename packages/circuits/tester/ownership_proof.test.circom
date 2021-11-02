include "../lib/ownership_proof.circom";

template OwnershipProofTest() {
  signal input note;
  signal input Ax;
  signal input Ay;
  signal input R8x;
  signal input R8y;
  signal input S;
  signal output result;

  component ownership_proof = OwnershipProof();
  ownership_proof.note <== note;
  ownership_proof.pub_key[0] <== Ax;
  ownership_proof.pub_key[1] <== Ay;
  ownership_proof.sig[0] <== R8x;
  ownership_proof.sig[1] <== R8y;
  ownership_proof.sig[2] <== S;
  result <== 1;
}

component main = OwnershipProofTest();
