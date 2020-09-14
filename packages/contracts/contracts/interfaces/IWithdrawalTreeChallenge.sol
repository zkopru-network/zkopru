// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

interface IWithdrawalTreeChallenge {
     function challengeWithdrawalIndex(
        bytes calldata parentHeader,
        bytes calldata blockData
    ) external;

     function challengeWithdrawalRoot(
        uint256[] calldata initialSiblings,
        bytes calldata parentHeader,
        bytes calldata blockData
    ) external;
}
