pragma solidity >= 0.6.0;

interface IWithdrawalTreeChallenge {
    /**
     * @dev Challenge when the submitted block's updated withdrawal tree index is invalid.
     * @param parentHeader Header object of its parent block
     * @param submission The proposal data which is exactly same with the submitted.
     */
     function challengeWithdrawalIndex(
        bytes calldata parentHeader,
        bytes calldata submission
    ) external;

    /**
     * @dev Challenge when the submitted block's updated withdrawal tree root is invalid.
     * @param initialSiblings Submit the siblings of the starting index leaf
     * @param parentHeader Header object of its parent block
     * @param submission The proposal data which is exactly same with the submitted.
     */
     function challengeWithdrawalRoot(
        uint256[] calldata initialSiblings,
        bytes calldata parentHeader,
        bytes calldata submission
    ) external;
}
