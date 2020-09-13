pragma solidity = 0.6.12;

interface IMigratable {
    function migrateTo(uint256 migrationId, address to) external;
}