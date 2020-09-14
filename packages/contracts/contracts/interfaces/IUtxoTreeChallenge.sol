// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

interface IUtxoTreeChallenge {
     function challengeUTXOIndex(
        uint256[] calldata deposits,
        bytes calldata parentHeader,
        bytes calldata blockData
    ) external;

     function challengeUTXORoot(
        uint256[] calldata deposits,
        uint256[] calldata initialSiblings,
        bytes calldata parentHeader,
        bytes calldata blockData
    ) external;
}
