pragma solidity >= 0.6.0;


contract Configurated {
    /**
     * Constants to manage this layer2 system.
     * Rationales: https://github.com/wilsonbeam/zk-optimistic-rollup/wiki
     */
    uint constant public CHALLENGE_PERIOD = 7 days;
    uint constant public CHALLENGE_LIMIT = 8000000;
    uint constant public MINIMUM_STAKE = 32 ether;
    uint constant public REF_DEPTH = 128;
    uint constant public POOL_SIZE = (1 << 31);
    uint constant public SUB_TREE_DEPTH = 5; // 32 items at once
    uint constant public SUB_TREE_SIZE = 1 << SUB_TREE_DEPTH;
}
