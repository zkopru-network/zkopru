include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/mux1.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

template NFTtoBits(size) {
    signal input nft;
    signal output out[size];
    component is_zero = IsZero();
    is_zero.in <== nft;
    component mux = Mux1();
    mux.s <== is_zero.out;
    mux.c[0] <== nft;
    mux.c[1] <== 1; /// means skipping the multiplication
    component bits = Num2Bits(size);
    bits.in <== mux.out;
    for (var i = 0; i < size; i++) {
        out[i] <== bits.out[i];
    }
}


template IfElseThen(n) {
    signal input obj1[n];
    signal input obj2[n];
    signal input if_v;
    signal input else_v;
    signal output out;
    component comparators[n];
    signal result[n + 1];
    result[0] <== 1;
    for(var i = 0; i < n; i++) {
        comparators[i] = IsEqual();
        comparators[i].in[0] <== obj1[i];
        comparators[i].in[1] <== obj2[i];
        result[i + 1] <== result[i] * comparators[i].out;
    }
    component mux = Mux1();
    mux.c[1] <== if_v;
    mux.c[0] <== else_v;
    mux.s <== result[n];
    out <== mux.out;
}

template ZeroToJubjubPrime(n) {
    signal input in[n];
    signal output out[n];

    component filter[n];
    component in_range[n];
    var prime_field = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    for(var i = 0; i < n; i++) {
        in_range[i] = LessThan(254);
        in_range[i].in[0] <== in[i];
        in_range[i].in[1] <== prime_field - 1;
        in_range[i].out === 1;

        filter[i] = IfElseThen(1);
        filter[i].obj1[0] <== in[i];
        filter[i].obj2[0] <== 0;
        filter[i].if_v <== prime_field - 1;
        filter[i].else_v <== in[i];
        out[i] <== filter[i].out;
    }
}
