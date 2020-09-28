include "../lib/ownership_proof.circom";

template OwnershipProofTest() {
  signal input note;
  signal input pG_x;
  signal input pG_y;
  signal input sig_r8x;
  signal input sig_r8y;
  signal input sig_s;
  signal output result;

  component ownership_proof = OwnershipProof();
  ownership_proof.note <== note;
  ownership_proof.pub_key[0] <== pG_x;
  ownership_proof.pub_key[1] <== pG_y;
  ownership_proof.sig[0] <== sig_r8x;
  ownership_proof.sig[1] <== sig_r8y;
  ownership_proof.sig[2] <== sig_s;
  result <== 1;
}

component main = OwnershipProofTest();
