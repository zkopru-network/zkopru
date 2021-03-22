include "../node_modules/circomlib/circuits/babyjub.circom";
include "./if_else_then.circom";

template ERC20Sum(n) {
    signal input addr;
    signal input note_addr[n];
    signal input note_amount[n];
    signal output out;
    // Filter with the given address and compute the sum of amount.
    // If we write the same logic in JS, that should be like below
    // 
    // out = notes
    //   .filter(note => note.addr == addr)
    //   .reduce((acc, note) => acc + note.amount)

    component sum[n];
    signal intermediates[n+1];
    intermediates[0] <== 0;
    for(var i = 0; i < n; i++) {
        sum[i] = IfElseThen(1);
        sum[i].obj1[0] <== addr;
        sum[i].obj2[0] <== note_addr[i];
        sum[i].if_v <== intermediates[i] + note_amount[i];
        sum[i].else_v <== intermediates[i];
        sum[i].out ==> intermediates[i+1];
    }
    out <== intermediates[n];
}
