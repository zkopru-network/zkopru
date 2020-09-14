// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

interface INullifierTreeChallenge {
    function challengeNullifierRollUp(
        uint256 numOfNullifiers,
        bytes32[254][] calldata siblings,
        bytes calldata parentHeader,
        bytes calldata blockData
    ) external;
}
