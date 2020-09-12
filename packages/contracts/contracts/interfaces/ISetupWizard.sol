pragma solidity = 0.6.12;
pragma experimental ABIEncoderV2;

import { SNARK } from "../libraries/SNARK.sol";

interface ISetupWizard {
    /**
     * @dev This configures a zk SNARK verification key to support the given transaction type
     * @param numOfInputs Number of inflow UTXOs
     * @param numOfOutputs Number of outflow UTXOs
     * @param vk SNARK verifying key for the given transaction type
     */
    function registerVk(
        uint8 numOfInputs,
        uint8 numOfOutputs,
        SNARK.VerifyingKey memory vk
    ) external;

    /**
     * @dev It connects this proxy contract to the UserInteractable controller.
     */
    function makeUserInteractable(address addr) external;

    /**
     * @dev It connects this proxy contract to the Challengeable controllers.
     */
    function makeChallengeable(
        address depositChallenge,
        address headerChallenge,
        address migrationChallenge,
        address utxoTreeChallenge,
        address withdrawalTreeChallenge,
        address nullifierTreeChallenge,
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
