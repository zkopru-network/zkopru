// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.7.4;

import { Hash } from "../../../contracts/zkopru/libraries/Hash.sol";

contract PoseidonPreHashTester {
    function preHashed() public pure returns (uint256[] memory) {
        return Hash.poseidonPrehashedZeroes();
    }
}