// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.7.4;

import {
    Hash,
    Poseidon2,
    Poseidon3,
    Poseidon4
} from "../../target/zkopru/libraries/Hash.sol";

contract PoseidonTester {
    function preHashed() public pure returns (uint256[] memory) {
        return Hash.poseidonPrehashedZeroes();
    }

    function poseidon2(uint256[2] memory inputs) public pure returns (uint256) {
        return Poseidon2.poseidon(inputs);
    }

    function poseidon3(uint256[3] memory inputs) public pure returns (uint256) {
        return Poseidon3.poseidon(inputs);
    }

    function poseidon4(uint256[4] memory inputs) public pure returns (uint256) {
        return Poseidon4.poseidon(inputs);
    }
}
