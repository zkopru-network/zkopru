pragma solidity = 0.6.12;

interface INullifierTreeChallenge {
    function challengeNullifierRollUp(
        uint256 numOfNullifiers,
        bytes32[254][] calldata siblings,
        bytes calldata parentHeader,
        bytes calldata blockData
    ) external;
}
