include "../node_modules/circomlib/circuits/poseidon.circom";

template NoteHash() {
    signal input eth;
    signal input pubkey_x;
    signal input pubkey_y;
    signal input salt;
    signal input token_addr;
    signal input erc20;
    signal input nft;
    signal output out;

    component intermediate_hash = Poseidon(4, 6, 8, 57);
    intermediate_hash.inputs[0] <== eth;
    intermediate_hash.inputs[1] <== pubkey_x;
    intermediate_hash.inputs[2] <== pubkey_y;
    intermediate_hash.inputs[3] <== salt;
    component final_result = Poseidon(4, 6, 8, 57);
    final_result.inputs[0] <== intermediate_hash.out;
    final_result.inputs[1] <== token_addr;
    final_result.inputs[2] <== erc20;
    final_result.inputs[3] <== nft;
    final_result.out ==> out;
}
