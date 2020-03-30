include "./utils.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/escalarmul.circom";

template AtomicSwapMPC() {
    signal input my_mpc_salt;
    signal input order[3];
    signal input giving_token_type;
    signal input giving_token_addr;
    signal input giving_note_salt;
    signal input counterpart_pk[2];
    signal input counterpart_computation[2]; /// counterpart_computation = g^(counterpart_mpc_salt * receiving_token_type * receiving_token_addr * receiving_note_salt * my_pk)
    signal output out[2];

    /// type 0: no-swap / 1: ETH / 2: ERC20 / 3: ERC721
    component correct_type = LessThan(3);
    correct_type.in[0] <== giving_token_type;
    correct_type.in[1] <== 4;
    correct_type.out === 1;

    /// Order data or token addr can include some zero values.
    /// If then, multiply (JUBJUB prime - 1) instead of zero.
    component filter = ZeroToJubjubPrime(4);
    filter.in[0] <== order[0];
    filter.in[1] <== order[1];
    filter.in[2] <== order[2];
    filter.in[3] <== giving_token_addr;

    /// Calculate scalar multiplication of the input values and the counterpart's public salt
    var BASE8 = [
        5299619240641551281634865583518297030282874472190772894086521144482721001553,
        16950150798460657717958625567821834550301663161624707787222815936182638968203
    ];
    component mpc = EscalarMul(9, BASE8);
    mpc.inp[0] <== counterpart_computation[0];
    mpc.inp[1] <== counterpart_computation[1];
    mpc.in[0] <== my_mpc_salt;
    mpc.in[1] <== filter.out[0] /// order[0];
    mpc.in[2] <== filter.out[1] /// order[1];
    mpc.in[3] <== filter.out[2] /// order[2];
    mpc.in[4] <== giving_token_type;
    mpc.in[5] <== filter.out[3] /// giving_token_addr;
    mpc.in[6] <== giving_note_salt;
    mpc.in[7] <== counterpart_pk[0];
    mpc.in[8] <== counterpart_pk[1];

    // Return outputs
    mpc.out[0] ==> out[0];
    mpc.out[1] ==> out[1];
}
