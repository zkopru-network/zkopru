pragma solidity >= 0.6.0;

interface IMigratable {
    /**
     * @dev You can do the mass migration using this function. To execute
     *      this function, the destination contract should inherits the
     *      "Migratable" contract and have registered this current contract's
     *      address as an allowed migrant.
     * @param migrationId Index of a MassMigration to execute.
     * @param to Address of the destination contract.
     */
    function migrateTo(uint migrationId, address to) external;
}