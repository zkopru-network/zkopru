// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import "../libraries/Types.sol";
import { Pairing } from "../libraries/Pairing.sol";
import { SNARK } from "../libraries/SNARK.sol";
import { Config } from "./Config.sol";

import { SMT254 } from "../libraries/SMT.sol";

contract Storage is Config {
    // State of the layer2 blockchain is maintained by the optimistic roll up
    Blockchain chain;

    // Addresses where to execute the given function call
    mapping(bytes4=>address) public proxied;

    // Addresses of onchain validation contracts
    mapping(bytes4=>address) public validators;

    // SNARK verifying keys assigned by the setup wizard for each tx type
    mapping(uint256=>SNARK.VerifyingKey) vks;

    // Addresses allowed to migrate from. Setup wizard manages the list
    mapping(address=>bool) public allowedMigrants;
}
