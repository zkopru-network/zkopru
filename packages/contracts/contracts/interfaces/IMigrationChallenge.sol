pragma solidity = 0.6.12;

interface IMigrationChallenge {
    function challengeMassMigrationToMassDeposit(
        address destination,
        bytes calldata blockData
    ) external;


    function challengeERC20Migration(
        address destination,
        address erc20,
        bytes calldata blockData
    ) external;


    function challengeERC721Migration(
        address destination,
        address erc721,
        uint256 tokenId,
        bytes calldata blockData
    ) external;
}