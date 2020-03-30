pragma solidity >= 0.6.0;

interface IDepositChallenge {
    function challengeMassDeposit(uint index, bytes calldata) external;
}