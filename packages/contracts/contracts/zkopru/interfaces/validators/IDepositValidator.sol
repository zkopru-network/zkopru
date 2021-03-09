// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.7.4;

interface IDepositValidator {
    function validateMassDeposit(bytes calldata blockData, uint256 index)
    external
    view
    returns (bool slash, string memory reason);
}