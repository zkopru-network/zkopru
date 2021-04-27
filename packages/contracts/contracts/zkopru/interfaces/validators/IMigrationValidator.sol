// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.7.4;

interface IMigrationValidator {
    function validateDuplicatedMigrations(
        bytes calldata blockData,
        uint256 massMigrationIdx1,
        uint256 massMigrationIdx2
    ) external pure returns (bool slash, string memory reason);

    function validateEthMigration(
        bytes calldata blockData,
        uint256 migrationIndex
    ) external pure returns (bool slash, string memory reason);

    function validateERC20Migration(
        bytes calldata blockData,
        uint256 migrationIndex
    ) external pure returns (bool slash, string memory reason);

    function validateMergedLeaves(
        bytes calldata blockData,
        uint256 migrationIndex
    ) external pure returns (bool slash, string memory reason);

    function validateMigrationFee(
        bytes calldata blockData,
        uint256 migrationIndex
    ) external pure returns (bool slash, string memory reason);

    function validateTokenRegistration(
        bytes calldata blockData,
        uint256 migrationIndex
    ) external view returns (bool slash, string memory reason);

    function validateMissedMassMigration(
        bytes calldata,
        uint256 txIndex,
        uint256 outflowIndex
    ) external pure returns (bool slash, string memory reason);
}
