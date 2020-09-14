// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

interface IMigrationChallenge {
    function challengeDuplicatedDestination(
        address destination,
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
        address destination,
        address erc20,
        bytes calldata blockData
    ) external;

    function challengeERC20Amount(
        uint256 migrationIndex,
        uint256 erc20Index,
        bytes calldata blockData
    ) external;

    function challengeDuplicatedERC721Migration(
        uint256 migrationIndex,
        address erc20Address,
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