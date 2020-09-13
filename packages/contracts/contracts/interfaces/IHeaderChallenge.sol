pragma solidity = 0.6.12;

interface IHeaderChallenge {
    function challengeDepositRoot(bytes calldata blockData) external;

    function challengeTxRoot(bytes calldata blockData) external;

    function challengeMigrationRoot(bytes calldata blockData) external;

    function challengeTotalFee(bytes calldata blockData) external;
}