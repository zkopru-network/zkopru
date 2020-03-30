pragma solidity >= 0.6.0;

interface ISetupWizard {
    /**
     * @dev This configures a zk SNARKs verification key to support the given transaction type
     * @param txType TxType.Transfer / TxType.Withdrawal / TxType.Migration
     * @param numOfInputs Number of inflow UTXOs
     * @param numOfOutputs Number of outflow UTXOs
     */
    function registerVk(
        uint8 txType,
        uint8 numOfInputs,
        uint8 numOfOutputs,
        uint[2] calldata alfa1,
        uint[2][2] calldata beta2,
        uint[2][2] calldata gamma2,
        uint[2][2] calldata delta2,
        uint[2][] calldata ic
    ) external;

    /**
     * @dev It connects this proxy contract to the UserInteractable controller.
     */
    function makeUserInteractable(address addr) external;

    /**
     * @dev It connects this proxy contract to the RollUpable controller.
     */
    function makeRollUpable(address addr) external;

    /**
     * @dev It connects this proxy contract to the Challengeable controllers.
     */
    function makeChallengeable(
        address depositChallenge,
        address headerChallenge,
        address migrationChallenge,
        address rollUpChallenge,
        address txChallenge
    ) external;

    /**
     * @dev It connects this proxy contract to the Migratable controller.
     */
    function makeMigratable(address addr) external;

    /**
     * @dev Migration process:
            1. On the destination contract, execute allowMigrants() to configure the allowed migrants.
               The departure contract should be in the allowed list.
            2. On the departure contract, execute migrateTo(). See "IMigratable.sol"
     * @param migrants List of contracts' address to allow migrations.
     */
    function allowMigrants(address[] calldata migrants) external;

    /**
     * @dev If you once execute this, every configuration freezes and does not change forever.
     */
    function completeSetup() external;
}
