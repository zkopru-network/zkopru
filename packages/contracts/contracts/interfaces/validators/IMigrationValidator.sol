// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

interface IMigrationValidator {
    function validateDuplicatedDestination(
        bytes calldata blockData,
        uint256 massMigrationIdx1,
        uint256 massMigrationIdx2
    )
    external
    view
    returns (bool slash, string memory reason);

    function validateTotalEth(
        bytes calldata blockData,
        uint256 migrationIndex
    )
    external
    view
    returns (bool slash, string memory reason);

    function validateMergedLeaves(
        bytes calldata blockData,
        uint256 migrationIndex
    )
    external
    view
    returns (bool slash, string memory reason);

    function validateMigrationFee(
        bytes calldata blockData,
        uint256 migrationIndex
    )
    external
    view
    returns (bool slash, string memory reason);

    function validateDuplicatedERC20Migration(
        bytes calldata blockData,
        uint256 migrationIndex,
        uint256 erc20MingrationIdx1,
        uint256 erc20MingrationIdx2
    )
    external
    view
    returns (bool slash, string memory reason);

    function validateERC20Amount(
        bytes calldata blockData,
        uint256 migrationIndex,
        uint256 erc20Index
    )
    external
    view
    returns (bool slash, string memory reason);

    function validateDuplicatedERC721Migration(
        bytes calldata blockData,
        uint256 migrationIndex,
        uint256 erc721MingrationIdx1,
        uint256 erc721MingrationIdx2
    )
    external
    view
    returns (bool slash, string memory reason);

    function validateNonFungibility(
        bytes calldata blockData,
        uint256 migrationIndex,
        uint256 erc721Index,
        uint256 tokenId
    )
    external
    view
    returns (bool slash, string memory reason);

    function validateNftExistence(
        bytes calldata blockData,
        uint256 migrationIndex,
        uint256 erc721Index,
        uint256 tokenId
    )
    external
    view
    returns (bool slash, string memory reason);
}