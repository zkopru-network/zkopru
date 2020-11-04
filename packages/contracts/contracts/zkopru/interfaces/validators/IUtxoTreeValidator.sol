// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

interface IUtxoTreeValidator {
    function validateUTXOIndex(
        bytes calldata blockData,
        bytes calldata parentHeader,
        uint256[] calldata deposits
    )
    external
    pure
    returns (bool slash, string memory reason);

    function validateUTXORoot(
        bytes calldata blockData,
        bytes calldata parentHeader,
        uint256[] calldata deposits,
        uint256[] calldata initialSiblings
    )
    external
    pure
    returns (bool slash, string memory reason);
}
