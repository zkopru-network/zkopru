include "./utils.circom";
include "./inclusion_proof.circom";
include "./erc20_sum.circom";
include "./non_fungible.circom";
include "./note_hash.circom";
include "./nullifier.circom";
include "./ownership_proof.circom";
//include "./atomic_swap_mpc.circom";
include "../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

/**
 * Note properties
 *  note[0]: ETH value
 *  note[1]: Pub Key x
 *  note[2]: Pub Key y
 *  note[3]: salt
 *  note[4]: token
 *  note[5]: amount if token is ERC20
 *  note[6]: nft id if token is ERC721
 * For the atomic swap, please see private order matching for zk atomic swap
 * https://ethresear.ch/
 */
template ZkTransaction(tree_depth, n_i, n_o) {
    /** Private Signals */
    // Spending notes
    signal private input spending_note[7][n_i];
    signal private input signatures[3][n_i];
    signal private input note_index[n_i];
    signal private input siblings[tree_depth][n_i];
    // New notes
    signal private input new_note[7][n_o];
    /** MPC atomic swap binder TODO later
    signal private input binding_factors[9];
    */

    /** Public Signals */
    /// tx fee
    signal input fee;
    /// for atomic swap
    signal input swap;
    /// preventing double-spending
    signal input inclusion_references[n_i];
    signal input nullifiers[n_i];
    /// UTXO note hash
    signal input new_note_hash[n_o];
    signal input typeof_new_note[n_o]; // 0: UTXO, 1: Withdrawal, 2: Migration
    signal input public_data[6][n_o]; // to, eth_amount, token_addr, erc20_amount, erc721_id, fee @ layer1


    /** MPC atomic swap: TODO later
    signal input binder[2]; // default: (0, 1)
    signal input counterpart_computation[2]; // default: (0, 1)
    */

    /** Constraints */
    /// Calculate spending note hash
    component note_hashes[n_i];
    for(var i = 0; i < n_i; i ++) {
        note_hashes[i] = NoteHash();
        note_hashes[i].eth <== spending_note[0][i];
        note_hashes[i].pubkey_x <== spending_note[1][i];
        note_hashes[i].pubkey_y <== spending_note[2][i];
        note_hashes[i].salt <== spending_note[3][i];
        note_hashes[i].token_addr <== spending_note[4][i];
        note_hashes[i].erc20 <== spending_note[5][i];
        note_hashes[i].nft <== spending_note[6][i];
    }

    /// Nullifier proof
    component spending_nullifier[n_i];
    for(var i = 0; i < n_i; i ++) {
        spending_nullifier[i] = Nullifier();   // Constant
        spending_nullifier[i].note_hash <== note_hashes[i].out; // note hash
        spending_nullifier[i].note_salt <== spending_note[3][i]; // note salt
        spending_nullifier[i].out === nullifiers[i];
    }

    /// Ownership proof
    component ownership_proof[n_i];
    for(var i = 0; i < n_i; i ++) {
        ownership_proof[i] = OwnershipProof();
        ownership_proof[i].note <== note_hashes[i].out;
        ownership_proof[i].pub_key[0] <== spending_note[1][i];
        ownership_proof[i].pub_key[1] <== spending_note[2][i];
        ownership_proof[i].sig[0] <== signatures[0][i];
        ownership_proof[i].sig[1] <== signatures[1][i];
        ownership_proof[i].sig[2] <== signatures[2][i];
    }

    /// Inclusion proof
    component inclusion_proof[n_i];
    for(var i = 0; i < n_i; i ++) {
        inclusion_proof[i] = InclusionProof(tree_depth);
        inclusion_proof[i].root <== inclusion_references[i];
        inclusion_proof[i].leaf <== note_hashes[i].out;
        inclusion_proof[i].path <== note_index[i];
        for(var j = 0; j < tree_depth; j++) {
            inclusion_proof[i].siblings[j] <== siblings[j][i];
        }
    }

    /// New note hash proof
    component poseidon_new_note_int[n_o];
    component poseidon_new_note[n_o];
    for(var i = 0; i < n_o; i ++) {
        poseidon_new_note_int[i] = Poseidon(4, 6, 8, 57);   // Constant
        poseidon_new_note_int[i].inputs[0] <== new_note[0][i];
        poseidon_new_note_int[i].inputs[1] <== new_note[1][i];
        poseidon_new_note_int[i].inputs[2] <== new_note[2][i];
        poseidon_new_note_int[i].inputs[3] <== new_note[3][i];
        poseidon_new_note[i] = Poseidon(4, 6, 8, 57);   // Constant
        poseidon_new_note[i].inputs[0] <== poseidon_new_note_int[i].out;
        poseidon_new_note[i].inputs[1] <== new_note[4][i];
        poseidon_new_note[i].inputs[2] <== new_note[5][i];
        poseidon_new_note[i].inputs[3] <== new_note[6][i];
        poseidon_new_note[i].out === new_note_hash[i];
    }

    /// Public data. "public_data.to == 0" means this note is a UTXO.
    /// Therefore if then every properties of public data must be zero.
    component revealed_eth[n_o];
    component revealed_token_addr[n_o];
    component revealed_erc20_amount[n_o];
    component revealed_erc721_id[n_o];
    signal typecheck_of_new_note[n_o];
    for(var i = 0; i < n_o; i ++) {
        typecheck_of_new_note[i] <== (typeof_new_note[i] - 1) * (typeof_new_note[i] - 2);
        typecheck_of_new_note[i] * typeof_new_note[i] === 0;

        revealed_eth[i] = IfElseThen(1);
        revealed_eth[i].obj1[0] <== typeof_new_note[i];
        revealed_eth[i].obj2[0] <== 0; // internal utxo type
        revealed_eth[i].if_v <== 0; // Do not reveal value
        revealed_eth[i].else_v <== new_note[0][i]; // eth amount

        revealed_token_addr[i] = IfElseThen(1);
        revealed_token_addr[i].obj1[0] <== typeof_new_note[i];
        revealed_token_addr[i].obj2[0] <== 0; // internal utxo type
        revealed_token_addr[i].if_v <== 0; // Do not reveal value
        revealed_token_addr[i].else_v <== new_note[4][i]; // token addr

        revealed_erc20_amount[i] = IfElseThen(1);
        revealed_erc20_amount[i].obj1[0] <== typeof_new_note[i];
        revealed_erc20_amount[i].obj2[0] <== 0; // internal utxo type
        revealed_erc20_amount[i].if_v <== 0; // Do not reveal nothing
        revealed_erc20_amount[i].else_v <== new_note[5][i]; // erc20 amount

        revealed_erc721_id[i] = IfElseThen(1);
        revealed_erc721_id[i].obj1[0] <== typeof_new_note[i];
        revealed_erc721_id[i].obj2[0] <== 0; // internal utxo type
        revealed_erc721_id[i].if_v <== 0; // Do not reveal nothing
        revealed_erc721_id[i].else_v <== new_note[6][i]; // erc721 id

        public_data[1][i] === revealed_eth[i].out;
        public_data[2][i] === revealed_token_addr[i].out;
        public_data[3][i] === revealed_erc20_amount[i].out;
        public_data[4][i] === revealed_erc721_id[i].out;
    }

    /// Range limitation to prevent overflow. Techincal maximum of inputs: 256
    var range_limit = (0 - 1) >> 8;
    component inflow_eth_range[n_i];
    for(var i = 0; i < n_i; i ++) {
        inflow_eth_range[i] = LessThan(254);
        inflow_eth_range[i].in[0] <== spending_note[0][i];
        inflow_eth_range[i].in[1] <== range_limit;
        inflow_eth_range[i].out === 1;
    }
    component inflow_erc20_range[n_i];
    for(var i = 0; i < n_i; i ++) {
        inflow_erc20_range[i] = LessThan(254);
        inflow_erc20_range[i].in[0] <== spending_note[5][i];
        inflow_erc20_range[i].in[1] <== range_limit;
        inflow_erc20_range[i].out === 1;
    }
    component outflow_eth_range[n_o];
    for(var i = 0; i < n_o; i ++) {
        outflow_eth_range[i] = LessThan(254);
        outflow_eth_range[i].in[0] <== new_note[0][i];
        outflow_eth_range[i].in[1] <== range_limit;
        outflow_eth_range[i].out === 1;
    }
    component outflow_erc20_range[n_o];
    for(var i = 0; i < n_o; i ++) {
        outflow_erc20_range[i] = LessThan(254);
        outflow_erc20_range[i].in[0] <== new_note[5][i];
        outflow_erc20_range[i].in[1] <== range_limit;
        outflow_erc20_range[i].out === 1;
    }

    /// Zero sum proof of ETH
    var eth_inflow = 0;
    var eth_outflow = 0;
    for ( var i = 0; i < n_i; i++) {
        eth_inflow += spending_note[0][i];
    }
    for ( var i = 0; i < n_o; i++) {
        eth_outflow += new_note[0][i]; // eth
        eth_outflow += public_data[5][i]; // fee for withdrawal or migration, default = 0
    }
    eth_outflow += fee;
    eth_inflow === eth_outflow;

    ///  Only one of ERC20 and ERC721 exists.
    for(var i = 0; i < n_i; i ++) {
        spending_note[5][i]*spending_note[6][i] === 0;
    }
    for(var i = 0; i < n_o; i ++) {
        new_note[5][i]*new_note[6][i] === 0;
    }


    /// Zero sum proof of ERC20
    component inflow_erc20[n_i];
    component outflow_erc20[n_i];
    for (var i = 0; i <n_i; i++) {
        inflow_erc20[i] = ERC20Sum(n_i);
        outflow_erc20[i] = ERC20Sum(n_o);
        inflow_erc20[i].addr <== spending_note[4][i];
        outflow_erc20[i].addr <== spending_note[4][i];
        for (var j = 0; j <n_i; j++) {
            inflow_erc20[i].note_addr[j] <== spending_note[4][j];
            inflow_erc20[i].note_amount[j] <== spending_note[5][j];
        }
        for (var j = 0; j <n_o; j++) {
            outflow_erc20[i].note_addr[j] <== new_note[4][j];
            outflow_erc20[i].note_amount[j] <== new_note[5][j];
        }
        inflow_erc20[i].out === outflow_erc20[i].out;
    }

    /// Non fungible proof of ERC721
    component non_fungible = NonFungible(n_i, n_o);
    for(var i = 0; i < n_i; i++) {
        non_fungible.prev_token_addr[i] <== spending_note[4][i];
        non_fungible.prev_token_nft[i] <== spending_note[6][i];
    }
    for(var i = 0; i < n_o; i++) {
        non_fungible.post_token_addr[i] <== new_note[4][i];
        non_fungible.post_token_nft[i] <== new_note[6][i];
    }

    /** MPC atomic swap: TODO later
    /// MPC proof
    component mpc = AtomicSwapMPC();
    mpc.my_mpc_salt <== binding_factors[0];
    mpc.order[0] <== binding_factors[1];
    mpc.order[1] <== binding_factors[2];
    mpc.order[2] <== binding_factors[3];
    mpc.giving_token_type <== binding_factors[4];
    mpc.giving_token_addr <== binding_factors[5];
    mpc.giving_note_salt <== binding_factors[6];
    mpc.counterpart_pk[0] <== binding_factors[7];
    mpc.counterpart_pk[1] <== binding_factors[8];
    mpc.counterpart_computation[0] <== counterpart_computation[0];
    mpc.counterpart_computation[1] <== counterpart_computation[1];

    binder[0] === mpc.out[0];
    binder[1] === mpc.out[1];

    /// eth for swap note
    component eth_amount = IfElseThen(1);
    eth_amount.obj1[0] <== mpc.giving_token_type;
    eth_amount.obj2[0] <== 1;
    eth_amount.if_v <== mpc.order[0];
    eth_amount.else_v <== 0;
    /// erc20 for swap note
    component erc20_amount = IfElseThen(1);
    erc20_amount.obj1[0] <== mpc.giving_token_type;
    erc20_amount.obj2[0] <== 2;
    erc20_amount.if_v <== mpc.order[1];
    erc20_amount.else_v <== 0;
    /// erc721 for swap note
    component erc721_id = IfElseThen(1);
    erc721_id.obj1[0] <== mpc.giving_token_type;
    erc721_id.obj2[0] <== 3;
    erc721_id.if_v <== mpc.order[2];
    erc721_id.else_v <== 0;
    /// If binder is not zero, the last item of new_note[] is the note for the atomic swap.
    component bound_note[7];
    for (var i = 0; i < 7; i ++) {
        bound_note[i] = IfElseThen(1);
        bound_note[i].obj1[0] <== binder[0];
        bound_note[i].obj2[0] <== 0;
        bound_note[i].if_v <== 0;
        bound_note[i].else_v <== new_note[i][n_o - 1];
    }
    /// Bind the note properties to the mpc factors
    bound_note[0].out === eth_amount.out;
    bound_note[1].out === mpc.counterpart_pk[0];
    bound_note[2].out === mpc.counterpart_pk[1];
    bound_note[3].out === mpc.giving_note_salt;
    bound_note[4].out === mpc.giving_token_addr;
    bound_note[5].out === erc20_amount.out;
    bound_note[6].out === erc721_id.out;
    */
}
