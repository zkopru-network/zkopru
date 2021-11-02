include "../node_modules/circomlib/circuits/poseidon.circom";

template Nullifier() {
    signal input nullifier_seed;
    signal input leaf_index;
    signal output out;
    // out = poseidon2(nullifier_seed, leaf_indexright)
    // https://docs.zkopru.network/v/burrito/how-it-works/account
    //
    // poseidon2 => {
    //     t: 3,
    //     nRoundsF: 8,
    //     nRoundsP: 57,
    // }
    // https://eprint.iacr.org/2019/458.pdf
    // https://github.com/iden3/circomlib/blob/86c6a2a6f5e8de4024a8d366eff9e35351bc1a2e/src/poseidon.js

    component hash = Poseidon(2);   // Constant
    hash.inputs[0] <== nullifier_seed;
    hash.inputs[1] <== leaf_index;
    hash.out ==> out;
}
