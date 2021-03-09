// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.7.4;

interface IMigratable {
    function migrateTo(uint256 migrationId, address to) external;
}