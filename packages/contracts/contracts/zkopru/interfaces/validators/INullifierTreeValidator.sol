// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

interface INullifierTreeValidator {
    function validateNullifierRollUp(
        bytes calldata blockData,
        bytes calldata parentHeader,
        uint256 numOfNullifiers,
        bytes32[254][] calldata siblings
    )
    external
    pure
    returns (bool slash, string memory reason);
}
