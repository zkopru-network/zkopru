include "../node_modules/circomlib/circuits/eddsaposeidon.circom";

template OwnershipProof() {
    // Signal definitions
    /** Private inputs */
    signal private input note;
    signal private input pub_key[2];
    signal private input sig[3];
    component eddsa = EdDSAPoseidonVerifier()
    eddsa.enabled <== 0;
    eddsa.M <== note;
    eddsa.Ax <== pub_key[0];
    eddsa.Ay <== pub_key[1];
    eddsa.R8x <== sig[0];
    eddsa.R8y <== sig[1];
    eddsa.S <== sig[2];
}
