// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

library SMT254 {
    // in Solidity: keccak256('exist')
    // in Web3JS: soliditySha3('exist')
    bytes32 constant public EXIST = 0xb0b4e07bb5592f3d3821b2c1331b436763d7be555cf452d6c6836f74d5201e85;
    // in Solidity: keccak256(abi.encodePacked(bytes32(0)))
    // in Web3JS: soliditySha3(0)
    bytes32 constant public NON_EXIST = 0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563;

    struct RollUp {
        bytes32 root;
        bytes32[] leaves;
        bytes32[254][] siblings;
    }

    struct OPRU {
        bytes32 prev;
        bytes32 next;
        bytes32 mergedLeaves;
    }

    function inclusionProof(
        bytes32 root,
        bytes32 leaf,
        bytes32[254] memory siblings
    ) internal pure returns(bool) {
        return merkleProof(root, leaf, EXIST, siblings);
    }

    function nonInclusionProof(
        bytes32 root,
        bytes32 leaf,
        bytes32[254] memory siblings
    ) internal pure returns(bool) {
        return merkleProof(root, leaf, NON_EXIST, siblings);
    }

    function merkleProof(
        bytes32 root,
        bytes32 leaf,
        bytes32 value,
        bytes32[254] memory siblings
    ) internal pure returns(bool) {
        require(calculateRoot(leaf, value, siblings) == root, "Invalid merkle proof");
        return true;
    }

    function calculateRoot(
        bytes32 leaf,
        bytes32 value,
        bytes32[254] memory siblings
    ) internal pure returns (bytes32) {
        bytes32 cursor = value;
        uint256 path = uint256(leaf);
        for (uint16 i = 0; i < siblings.length; i++) {
            if (path % 2 == 0) {
                // Right sibling
                cursor = keccak256(abi.encodePacked(cursor, siblings[i]));
            } else {
                // Left sibling
                cursor = keccak256(abi.encodePacked(siblings[i], cursor));
            }
            path = path >> 1;
        }
        return cursor;
    }

    function append(
        bytes32 root,
        bytes32 leaf,
        bytes32[254] memory siblings
    ) internal pure returns (bytes32 nextRoot) {
        // Prove that the array of sibling is valid and also the leaf does not exist in the tree
        require(nonInclusionProof(root, leaf, siblings), "Failed to build the previous root using jthe leaf and its sibling");
        // Calculate the new root when the leaf exists using its proven siblings
        nextRoot = calculateRoot(leaf, EXIST, siblings);
        // Make sure it has been updated
        require(root != nextRoot, "Already exisiting leaf");
    }

    function rollUp(RollUp memory proof) internal pure returns (bytes32) {
        // Inspect the RollUp structure
        require(proof.leaves.length == proof.siblings.length, "Both array should have same length");
        // Start from the root
        bytes32 root = proof.root;
        // Update the root using append function
        for (uint256 i = 0; i < proof.leaves.length; i ++) {
            root = append(root, proof.leaves[i], proof.siblings[i]);
        }
        return root;
    }

    function rollUp(
        bytes32 root,
        bytes32[] memory leaves,
        bytes32[254][] memory siblings
    ) internal pure returns (bytes32 nextRoot) {
        nextRoot = rollUp(RollUp(root, leaves, siblings));
    }

    function rollUpProof(
        bytes32 root,
        bytes32 nextRoot,
        bytes32[] memory leaves,
        bytes32[254][] memory siblings
    ) internal pure returns (bool) {
        require(nextRoot == rollUp(RollUp(root, leaves, siblings)), "Failed to drive the next root from the proof");
    }

    function newOPRU(bytes32 startingRoot) internal pure returns (OPRU memory opru) {
        opru.prev = startingRoot;
        opru.next = startingRoot;
        opru.mergedLeaves = bytes32(0);
    }

    function update(
        OPRU storage opru,
        bytes32[] memory leaves,
        bytes32[254][] memory siblings
    ) internal {
        opru.next = rollUp(opru.next, leaves, siblings);
        opru.mergedLeaves = merge(opru.mergedLeaves, leaves);
    }

    function verify(
        OPRU memory opru,
        bytes32 prev,
        bytes32 next,
        bytes32 mergedLeaves
    ) internal pure returns (bool) {
        require(opru.prev == prev, "Started with different root");
        require(opru.mergedLeaves == mergedLeaves, "Appended different leaves");
        return opru.next == next;
    }

    function merge(
        bytes32 base,
        bytes32[] memory leaves
    ) internal pure returns (bytes32 mergedLeaves) {
        mergedLeaves = base;
        for(uint256 i = 0; i < leaves.length; i++) {
            mergedLeaves = keccak256(abi.encodePacked(mergedLeaves, leaves[i]));
        }
    }
}