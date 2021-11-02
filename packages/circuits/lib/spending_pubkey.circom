include "../node_modules/circomlib/circuits/poseidon.circom";

template SpendingPubKey() {
    signal input pubkey_x;
    signal input pubkey_y;
    signal input nullifier_seed;
    signal output out;
    // out = poseidon3(pubkey_x, pubkey_y, nullifier_seed)
    // https://docs.zkopru.network/v/burrito/how-it-works/account
    //
    // poseidon3 => {
    //     t: 4,
    //     nRoundsF: 8,
    //     nRoundsP: 56,
    // }
    // https://eprint.iacr.org/2019/458.pdf
    // https://github.com/iden3/circomlib/blob/86c6a2a6f5e8de4024a8d366eff9e35351bc1a2e/src/poseidon.js

    component hash = Poseidon(3);   // Constant
    hash.inputs[0] <== pubkey_x;
    hash.inputs[1] <== pubkey_y;
    hash.inputs[2] <== nullifier_seed;
    hash.out ==> out;
}
