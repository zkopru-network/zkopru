include "../node_modules/circomlib/circuits/poseidon.circom";

template AssetHash() {
    signal input eth;
    signal input token_addr;
    signal input erc20;
    signal input erc721;
    signal output out;
    // out = poseidon4(eth, token_addr, erc20, erc721)
    //
    // poseidon4 => {
    //     t: 5,
    //     nRoundsF: 8,
    //     nRoundsP: 60,
    // }
    // https://eprint.iacr.org/2019/458.pdf
    // https://github.com/iden3/circomlib/blob/86c6a2a6f5e8de4024a8d366eff9e35351bc1a2e/src/poseidon.js

    component hash = Poseidon(4);
    hash.inputs[0] <== eth;
    hash.inputs[1] <== token_addr;
    hash.inputs[2] <== erc20;
    hash.inputs[3] <== erc721;
    hash.out ==> out;
}
