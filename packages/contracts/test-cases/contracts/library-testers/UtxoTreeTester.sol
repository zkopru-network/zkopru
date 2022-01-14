// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.7.4;

import {
    Hasher,
    MerkleTreeLib,
    SubTreeLib
} from "../../target/zkopru/libraries/MerkleTree.sol";

import { Hash } from "../../target/zkopru/libraries/Hash.sol";

contract UtxoTreeTester {
    using MerkleTreeLib for Hasher;
    using SubTreeLib for Hasher;

    function append(
        uint256 startingRoot,
        uint256 index,
        uint256[] memory leaves,
        uint256[] memory initialSiblings
    ) public pure returns (uint256 newRoot) {
        return
            Hash.poseidon().append(
                startingRoot,
                index,
                leaves,
                initialSiblings
            );
    }

    function merkleProof(
        uint256 root,
        uint256 leaf,
        uint256 index,
        uint256[] memory siblings
    ) public pure returns (bool) {
        return Hash.poseidon().merkleProof(root, leaf, index, siblings);
    }

    function appendSubTree(
        uint256 startingRoot,
        uint256 index,
        uint256 subTreeDepth,
        uint256[] memory leaves,
        uint256[] memory subTreeSiblings
    ) public pure returns (uint256 newRoot) {
        return
            Hash.poseidon().append(
                startingRoot,
                index,
                subTreeDepth,
                leaves,
                subTreeSiblings
            );
    }
}
