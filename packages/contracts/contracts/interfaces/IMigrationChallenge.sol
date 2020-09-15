// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

interface IMigrationChallenge {
    function challengeDuplicatedDestination(
        uint256 massMigrationIdx1,
        uint256 massMigrationIdx2,
        bytes calldata blockData
    ) external;

    function challengeTotalEth(
        uint256 migrationIndex,
        bytes calldata blockData
    ) external;

    function challengeMergedLeaves(
        uint256 migrationIndex,
        bytes calldata blockData
    ) external;

    function challengeMigrationFee(
        uint256 migrationIndex,
        bytes calldata blockData
    ) external;

    function challengeDuplicatedERC20Migration(
        uint256 migrationIndex,
        uint256 erc20MingrationIdx1,
        uint256 erc20MingrationIdx2,
        bytes calldata blockData
    ) external;

    function challengeERC20Amount(
        uint256 migrationIndex,
        uint256 erc20Index,
        bytes calldata blockData
    ) external;

    function challengeDuplicatedERC721Migration(
        uint256 migrationIndex,
        uint256 erc721MingrationIdx1,
        uint256 erc721MingrationIdx2,
        bytes calldata blockData
    ) external;

    function challengeNonFungibility(
        uint256 migrationIndex,
        uint256 erc721Index,
        uint256 tokenId,
        bytes calldata blockData
    ) external;

    function challengeNftExistence(
        uint256 migrationIndex,
        uint256 erc721Index,
        uint256 tokenId,
        bytes calldata blockData
    ) external;
}