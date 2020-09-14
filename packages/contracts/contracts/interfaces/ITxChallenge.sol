// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

interface ITxChallenge {
    function challengeInclusion(uint256 txIndex, uint256 inflowIndex, bytes calldata blockData) external;

    function challengeTransaction(uint256 txIndex, bytes calldata blockData) external;

    function challengeAtomicSwap(uint256 txIndex, bytes calldata blockData) external;

    function challengeUsedNullifier(uint256 txIndex, uint256 inflowIndex, bytes32[254] calldata sibling, bytes calldata blockData) external;

    function challengeDuplicatedNullifier(bytes32 nullifier, bytes calldata blockData) external;

    function isValidRef(bytes32 l2BlockHash, uint256 ref) external view returns (bool);
}