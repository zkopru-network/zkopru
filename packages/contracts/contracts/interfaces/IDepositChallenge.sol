pragma solidity >= 0.6.0;

interface IDepositChallenge {
    function challengeMassDeposit(uint256 index, bytes calldata) external;
}