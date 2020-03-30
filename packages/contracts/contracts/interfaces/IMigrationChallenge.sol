pragma solidity >= 0.6.0;

interface IMigrationChallenge {
    /**
     * @param destination Address of another layer 2 contract
     * @param submission The proposal data which is exactly same with the submitted.
     */
    function challengeMassMigrationToMassDeposit(
        address destination,
        bytes calldata submission
    ) external;


    function challengeERC20Migration(
        address destination,
        address erc20,
        bytes calldata submission
    ) external;


    function challengeERC721Migration(
        address destination,
        address erc721,
        uint tokenId,
        bytes calldata submission
    ) external;
}