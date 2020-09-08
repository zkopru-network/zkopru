pragma solidity >= 0.6.0;

interface IUtxoTreeChallenge {
    /**
     * @dev Challenge when the submitted block's updated utxo tree index is invalid.
     * @param deposits Submit all deposit leaves to be merged.
     * @param parentHeader Header object of its parent block
     * @param submission The proposal data which is exactly same with the submitted.
     */
     function challengeUTXOIndex(
        uint[] calldata deposits,
        bytes calldata parentHeader,
        bytes calldata submission
    ) external;

    /**
     * @dev Challenge when the submitted block's updated utxo tree root is invalid.
     * @param deposits Submit all deposit leaves to be merged.
     * @param initialSiblings Submit the siblings of the starting index leaf
     * @param parentHeader Header object of its parent block
     * @param submission The proposal data which is exactly same with the submitted.
     */
     function challengeUTXORoot(
        uint[] calldata deposits,
        uint[] calldata initialSiblings,
        bytes calldata parentHeader,
        bytes calldata submission
    ) external;
}
