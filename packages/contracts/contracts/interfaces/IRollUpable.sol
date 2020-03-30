pragma solidity >= 0.6.0;

interface IRollUpable {
    /**
     * @dev Challenger starts to generate a proof for the UTXO tree transition
     */
    function newProofOfUTXORollUp(uint startingRoot, uint startingIndex, uint[] calldata initialSiblings) external;

    /**
     * @dev Challenger starts to generate a proof for the nullifier tree transition
     */
    function newProofOfNullifierRollUp(bytes32 prevRoot) external;

    /**
     * @dev Challenger starts to generate a proof for the withdrawal tree transition
     */
    function newProofOfWithdrawalRollUp(uint startingRoot, uint startingIndex) external;

    /**
     * @dev Challenger appends items to the utxo tree and record the intermediate result on the storage.
     *      This Poseidon sub tree roll up costs around 5.8 million gas to append 32 items.
     */
    function updateProofOfUTXORollUp(uint id, uint[] calldata leaves) external;

    /**
     * @dev Challenger appends items to the nullifier tree and record the intermediate result on the storage.
     */
    function updateProofOfNullifierRollUp(uint id, bytes32[] calldata leaves, bytes32[256][] calldata siblings) external;

    /**
     * @dev Challenger appends items to the withdrawal tree and record the intermediate result on the storage
     *      This keccak sub tree roll up costs around 300k gas to append 32 items.
     */
    function updateProofOfWithdrawalRollUp(uint id, uint[] calldata initialSiblings, uint[] calldata leaves) external;
}
