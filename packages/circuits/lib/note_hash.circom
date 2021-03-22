include "../node_modules/circomlib/circuits/poseidon.circom";

template NoteHash() {
    signal input spending_pubkey;
    signal input salt;
    signal input asset_hash;
    signal output out;
    // out = poseidon3(spending_pubkey, salt, asset_hash)
    // https://docs.zkopru.network/v/burrito/how-it-works/utxo
    //
    // poseidon3 => {
    //     t: 4,
    //     nRoundsF: 8,
    //     nRoundsP: 56,
    // }
    // https://eprint.iacr.org/2019/458.pdf
    // https://github.com/iden3/circomlib/blob/86c6a2a6f5e8de4024a8d366eff9e35351bc1a2e/src/poseidon.js

    component hash = Poseidon(3);
    hash.inputs[0] <== spending_pubkey;
    hash.inputs[1] <== salt;
    hash.inputs[2] <== asset_hash;
    hash.out ==> out;
}
