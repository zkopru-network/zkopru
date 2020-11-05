// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;
pragma experimental ABIEncoderV2;

import { SNARK } from "../libraries/SNARK.sol";

interface ISetupWizard {
    function registerVk(
        uint8 numOfInputs,
        uint8 numOfOutputs,
        SNARK.VerifyingKey memory vk
    ) external;

    function makeConfigurable(address addr) external;

    function makeUserInteractable(address addr) external;

    function makeCoordinatable(address addr) external;

    function makeChallengeable(
        address challengeable,
        address depositValidator,
        address headerValidator,
        address migrationValidator,
        address utxoTreeValidator,
        address withdrawalTreeValidator,
        address nullifierTreeValidator,
        address txValidator
    ) external;

    function makeMigratable(address addr) external;

    function allowMigrants(address[] calldata migrants) external;

    function completeSetup() external;
}
