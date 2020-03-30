pragma solidity >= 0.6.0;

interface ITxChallenge {
    /**
     * @dev Challenge when any of the used nullifier's inclusion reference is invalid.
     * @param txType Type of the transaction.
     * @param txIndex Index of the transaction in the tx list of the block body.
     * @param inflowIndex Index of the inflow note in the tx.
     * @param submission The proposal data which is exactly same with the submitted.
     */
    function challengeInclusion(uint8 txType, uint txIndex, uint inflowIndex, bytes calldata submission) external;

    /**
     * @dev Challenge when any submitted transaction has an invalid SNARKs proof
     * @param txIndex Index of the transaction in the tx list of the block body.
     * @param submission The proposal data which is exactly same with the submitted.
     */
    function challengeTransaction(uint txIndex, bytes calldata submission) external;

    /**
     * @dev Challenge when the block is trying to use an already used nullifier.
     * @param txIndex Index of the transaction in the tx list of the block body.
     * @param inflowIndex Index of the inflow note in the tx.
     * @param sibling The sibling data of the nullifier.
     * @param submission The proposal data which is exactly same with the submitted.
     */
    function challengeUsedNullifier(uint txIndex, uint inflowIndex, bytes32[256] calldata sibling, bytes calldata submission) external;

    /**
     * @dev Challenge when a nullifier used twice in a same block.
     * @param nullifier Double included nullifier.
     * @param submission The proposal data which is exactly same with the submitted.
     */
    function challengeDuplicatedNullifier(bytes32 nullifier, bytes calldata submission) external;

    /**
     * @notice It checks the validity of an inclusion refernce for a nullifier.
     * @dev Each nullifier should be paired with an inclusion reference which is a root of
     *      utxo tree. For the inclusion reference, You can use finalized roots or recent
     *      blocks' utxo roots. When you use recent blocks' utxo roots, recent REF_DEPTH
     *      of utxo roots are available. It costs maximum 1800*REF_DEPTH gas to validate
     *      an inclusion reference during the TX challenge process.
     * @param l2BlockHash Layer2 block's hash value where to start searching for.
     * @param ref Utxo root which includes the nullifier's origin utxo.
     */
    function isValidRef(bytes32 l2BlockHash, uint256 ref) external view returns (bool);
}