// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.7.4;
pragma experimental ABIEncoderV2;

import { MassMigration } from "../libraries/Types.sol";

interface IMigratable {
    function migrateFrom(
        address source,
        bytes32 migrationRoot,
        MassMigration calldata migration,
        uint256 index,
        bytes32[] calldata siblings,
        bytes32[] calldata leaves
    ) external;

    function transfer(
        bytes32 migrationRoot,
        MassMigration calldata migration,
        uint256 index,
        bytes32[] calldata siblings
    ) external;
}
