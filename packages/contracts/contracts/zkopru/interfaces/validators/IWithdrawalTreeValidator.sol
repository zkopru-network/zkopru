// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.7.4;

interface IWithdrawalTreeValidator {
    function validateWithdrawalIndex(
        bytes calldata blockData,
        bytes calldata parentHeader
    ) external pure returns (bool slash, string memory reason);

    function validateWithdrawalRoot(
        bytes calldata blockData,
        bytes calldata parentHeader,
        uint256[] calldata initialSiblings
    ) external pure returns (bool slash, string memory reason);
}
