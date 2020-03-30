pragma solidity >= 0.6.0;

import { SetupWizard } from "./SetupWizard.sol";

contract ZkOptimisticRollUp is SetupWizard {
    constructor(address _setupWizard) SetupWizard(_setupWizard) public {
    }
}
