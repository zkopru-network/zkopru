// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

interface IMigratable {
    function migrateTo(uint256 migrationId, address to) external;
}