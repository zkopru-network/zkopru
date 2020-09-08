pragma solidity >= 0.6.0;

interface INullifierTreeChallenge {
    /**
     * @dev Challenge when the submitted block's nullifier tree transition is invalid.
     * @param numOfNullifiers Number of used nullifiers to help the computation.
     * @param siblings Siblings of each nullifier.
     * @param parentHeader Header object of its parent block
     * @param submission The proposal data which is exactly same with the submitted.
     */
    function challengeNullifierRollUp(
        uint numOfNullifiers,
        bytes32[254][] calldata siblings,
        bytes calldata parentHeader,
        bytes calldata submission
    ) external;
}
