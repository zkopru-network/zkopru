// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import { Storage } from "../../storage/Storage.sol";
import {
    Block,
    MassDeposit,
    Types
} from "../../libraries/Types.sol";
import { Deserializer } from "../../libraries/Deserializer.sol";
import { IDepositValidator } from "../../interfaces/validators/IDepositValidator.sol";

contract DepositValidator is Storage, IDepositValidator {
    using Types for MassDeposit;

    /**
     * @dev Challenge when a submitted mass deposit is invalid
     * @param // blockData Serialized block data
     * @param index Index of the mass deposit in the block body's mass deposit array
     */
    function validateMassDeposit(bytes calldata, uint256 index)
    external
    view
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        MassDeposit memory massDeposit = _block.body.massDeposits[index];
        if(chain.committedDeposits[massDeposit.hash()] == 0) {
            // code D1: "This deposit queue is not committed"
            return (true, "D1");
        }
    }
}
