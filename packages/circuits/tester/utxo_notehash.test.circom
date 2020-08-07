include "../lib/nullifier.circom";
include "../lib/note_hash.circom";
include "../lib/asset_hash.circom";
include "../lib/spending_pubkey.circom";
include "../lib/ownership_proof.circom";

template UtxoNoteHash() {
  signal private input pG_x;
  signal private input pG_y;
  signal private input sig_r8x;
  signal private input sig_r8y;
  signal private input sig_s;
  signal private input nullifier_seed;
  signal private input salt;
  signal private input eth;
  signal private input token_addr;
  signal private input erc20;
  signal private input erc721;
  signal private input leaf_index;
  signal private input nullifier;
  signal input note_hash;

  component spending_pubkey = SpendingPubKey()
  spending_pubkey.pubkey_x <== pG_x;
  spending_pubkey.pubkey_y <== pG_y;
  spending_pubkey.nullifier_seed <== nullifier_seed;

  component note_asset = AssetHash()
  note_asset.eth <== eth;
  note_asset.token_addr <== token_addr;
  note_asset.erc20 <== erc20;
  note_asset.erc721 <== erc721;

  component note = NoteHash();
  note.spending_pubkey <== spending_pubkey.out;
  note.salt <== salt;
  note.asset_hash <== note_asset.out;
  note.out === note_hash;

  component n = Nullifier();
  n.nullifier_seed <== nullifier_seed;
  n.leaf_index <== leaf_index;
  n.out === nullifier;

  component ownership_proof = OwnershipProof();
  ownership_proof.note <== note_hash;
  ownership_proof.pub_key[0] <== pG_x;
  ownership_proof.pub_key[1] <== pG_y;
  ownership_proof.sig[0] <== sig_r8x;
  ownership_proof.sig[1] <== sig_r8y;
  ownership_proof.sig[2] <== sig_s;
}

component main = UtxoNoteHash();
