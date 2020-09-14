// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

interface IDepositChallenge {
    function challengeMassDeposit(uint256 index, bytes calldata) external;
}