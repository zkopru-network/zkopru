pragma solidity >= 0.6.0;


contract Configurated {
    /**
     * Constants to manage this layer2 system.
     * Rationales: https://github.com/wilsonbeam/zk-optimistic-rollup/wiki
     */
    uint constant public CHALLENGE_PERIOD = 7 seconds;
    // uint constant public CHALLENGE_LIMIT = 8000000;
    uint constant public MINIMUM_STAKE = 32 ether;
    uint constant public REF_DEPTH = 128;
    uint constant public UTXO_TREE_DEPTH = 48;
    uint constant public MAX_UTXO = (1 << UTXO_TREE_DEPTH);
    uint constant public WITHDRAWAL_TREE_DEPTH = 48;
    uint constant public MAX_WITHDRAWAL = (1 << WITHDRAWAL_TREE_DEPTH);
    uint constant public NULLIFIER_TREE_DEPTH = 254;

    uint constant public UTXO_SUB_TREE_DEPTH = 5; // 32 items at once
    uint constant public UTXO_SUB_TREE_SIZE = 1 << UTXO_SUB_TREE_DEPTH;
    uint constant public WITHDRAWAL_SUB_TREE_DEPTH = 5; // 32 items at once
    uint constant public WITHDRAWAL_SUB_TREE_SIZE = 1 << WITHDRAWAL_SUB_TREE_DEPTH;
}
