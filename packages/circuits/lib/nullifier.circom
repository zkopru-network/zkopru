include "../node_modules/circomlib/circuits/poseidon.circom";

template Nullifier() {
    signal input note_hash;
    signal input note_salt;
    signal output out;

    component hash = Poseidon(2, 6, 8, 57);   // Constant
    hash.inputs[0] <== note_hash;
    hash.inputs[1] <== note_salt;
    hash.out ==> out;
}
