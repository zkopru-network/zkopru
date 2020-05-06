include "../lib/nullifier.circom";
include "../lib/note_hash.circom";

template NullifierFromNote() {
  signal private input eth;
  signal private input pubkey_x;
  signal private input pubkey_y;
  signal private input salt;
  signal private input token_addr;
  signal private input erc20;
  signal private input nft;
  signal private input note_hash;
  signal private input nullifier;
  component note = NoteHash();
  note.eth <== eth;
  note.pubkey_x <== pubkey_x;
  note.pubkey_y <== pubkey_y;
  note.salt <== salt;
  note.token_addr <== token_addr;
  note.erc20 <== erc20;
  note.nft <== nft;
  note.out === note_hash
  component n = Nullifier();
  n.note_hash <== note.out;
  n.note_salt <== salt;
  n.out === nullifier
}

component main = NullifierFromNote();
