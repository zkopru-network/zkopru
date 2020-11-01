// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

library SMT254 {
    // in Solidity: keccak256('exist')
    // in Web3JS: soliditySha3('exist')
    bytes32 constant public EXIST = bytes32(uint256(1));
    // in Solidity: keccak256(abi.encodePacked(bytes32(0)))
    // in Web3JS: soliditySha3(0)
    bytes32 constant public NON_EXIST = 0;

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

    function fill(
        bytes32 prevRoot,
        bytes32 leaf,
        bytes32[254] memory siblings
    ) internal pure returns (bytes32 nextRoot) {
        // Prove that the array of sibling is valid and also the leaf does not exist in the tree
        require(nonInclusionProof(prevRoot, leaf, siblings), "Failed to build the previous root using the leaf and its sibling");
        // Calculate the new root when the leaf exists using its proven siblings
        nextRoot = calculateRoot(leaf, EXIST, siblings);
        // Make sure it has been updated
        require(prevRoot != nextRoot, "Already existing leaf");
    }

    function fill(
        bytes32 prevRoot,
        bytes32[] memory leaves,
        bytes32[254][] memory siblings
    ) internal pure returns (bytes32 nextRoot) {
        // Inspect the RollUp structure
        require(leaves.length == siblings.length, "Both array should have same length");
        // Start from the root
        bytes32 root = prevRoot;
        // Update the root using fill function
        for (uint256 i = 0; i < leaves.length; i ++) {
            root = fill(root, leaves[i], siblings[i]);
        }
        return root;
    }
}