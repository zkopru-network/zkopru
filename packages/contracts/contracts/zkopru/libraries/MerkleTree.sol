// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.7.4;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

struct Hasher {
    function(uint256, uint256) internal pure returns (uint256) parentOf;
    uint256[] preHashedZero;
}

struct TreeSnapshot {
    uint256 root;
    uint256 index;
}

struct OPRU {
    TreeSnapshot start;
    TreeSnapshot result;
    bytes32 mergedLeaves;
}

struct TreeUpdateProof {
    address owner;
    OPRU opru;
    uint256[] cachedSiblings;
}

library MerkleTreeLib {
    using SafeMath for uint256;

    function append(
        Hasher memory self,
        uint256 startingRoot,
        uint256 index,
        uint256[] memory leaves,
        uint256[] memory initialSiblings
    ) internal pure returns (uint256 newRoot) {
        newRoot = startingRoot;
        require(
            self.preHashedZero.length == initialSiblings.length + 1,
            "Submitted invalid length of siblings"
        );
        require(
            startingLeafProof(self, startingRoot, index, initialSiblings),
            "Invalid merkle proof of starting leaf node"
        );
        uint256 nextIndex = index;
        uint256[] memory nextSiblings = initialSiblings;
        for (uint256 i = 0; i < leaves.length; i++) {
            (newRoot, nextIndex, nextSiblings) = _appendLeaf(
                self,
                nextIndex,
                leaves[i],
                nextSiblings
            );
        }
    }

    function merkleProof(
        Hasher memory self,
        uint256 root,
        uint256 leaf,
        uint256 index,
        uint256[] memory siblings
    ) internal pure returns (bool) {
        return merkleRoot(self, leaf, index, siblings) == root;
    }

    function merkleRoot(
        Hasher memory self,
        uint256 leaf,
        uint256 index,
        uint256[] memory siblings
    ) internal pure returns (uint256) {
        uint256 path = index;
        uint256 node = leaf;
        for (uint256 i = 0; i < siblings.length; i++) {
            if (path % 2 == 0) {
                // right sibling
                node = self.parentOf(node, siblings[i]);
            } else {
                // left sibling
                node = self.parentOf(siblings[i], node);
            }
            path >>= 1;
        }
        return node;
    }

    function startingLeafProof(
        Hasher memory self,
        uint256 root,
        uint256 index,
        uint256[] memory siblings
    ) internal pure returns (bool) {
        uint256 path = index;
        uint256 node = self.preHashedZero[0];
        for (uint256 i = 0; i < siblings.length; i++) {
            if (path % 2 == 0) {
                // Right sibling should be a prehashed zero
                if (siblings[i] != self.preHashedZero[i]) {
                    return false;
                }
                node = self.parentOf(node, siblings[i]);
            } else {
                // Left sibling should not be a prehashed zero
                if (siblings[i] == self.preHashedZero[i]) {
                    return false;
                }
                node = self.parentOf(siblings[i], node);
            }
            path >>= 1;
        }
        return node == root;
    }

    function _appendLeaf(
        Hasher memory self,
        uint256 index,
        uint256 leaf,
        uint256[] memory siblings
    )
        private
        pure
        returns (
            uint256 nextRoot,
            uint256 nextIndex,
            uint256[] memory nextSiblings
        )
    {
        nextSiblings = new uint256[](siblings.length);
        uint256 path = index;
        uint256 node = leaf;
        for (uint256 level = 0; level < siblings.length; level++) {
            if (path % 2 == 0) {
                // right empty sibling
                nextSiblings[level] = node; // current node will be the next merkle proof's left sibling
                node = self.parentOf(node, self.preHashedZero[level]);
            } else {
                // left sibling
                nextSiblings[level] = siblings[level]; // keep current sibling
                node = self.parentOf(siblings[level], node);
            }
            path >>= 1;
        }
        nextRoot = node;
        nextIndex = index + 1;
    }
}

library SubTreeLib {
    using MerkleTreeLib for Hasher;
    using MerkleTreeLib for bytes32;

    function append(
        Hasher memory self,
        uint256 startingRoot,
        uint256 index,
        uint256 subTreeDepth,
        uint256[] memory leaves,
        uint256[] memory subTreeSiblings
    ) internal pure returns (uint256 newRoot) {
        newRoot = startingRoot;
        require(index % (1 << subTreeDepth) == 0, "Can't merge a subTree");
        require(
            self.preHashedZero.length ==
                subTreeDepth + subTreeSiblings.length + 1,
            "Should submit subtree's siblings"
        );
        require(
            emptySubTreeProof(
                self,
                startingRoot,
                index,
                subTreeDepth,
                subTreeSiblings
            ),
            "Insertion is not allowed"
        );
        uint256 nextIndex = index;
        uint256[][] memory subTrees = splitToSubTrees(leaves, subTreeDepth);
        uint256[] memory nextSiblings = subTreeSiblings;
        for (uint256 i = 0; i < subTrees.length; i++) {
            (newRoot, nextIndex, nextSiblings) = appendSubTree(
                self,
                nextIndex,
                subTreeDepth,
                subTrees[i],
                nextSiblings
            );
        }
        return newRoot;
    }

    function splitToSubTrees(uint256[] memory leaves, uint256 subTreeDepth)
        internal
        pure
        returns (uint256[][] memory subTrees)
    {
        uint256 subTreeSize = 1 << subTreeDepth;
        uint256 numOfSubTrees =
            (leaves.length / subTreeSize) +
                (leaves.length % subTreeSize == 0 ? 0 : 1);
        subTrees = new uint256[][](numOfSubTrees);
        for (uint256 i = 0; i < numOfSubTrees; i++) {
            subTrees[i] = new uint256[](subTreeSize);
        }
        uint256 index = 0;
        uint256 subTreeIndex = 0;
        for (uint256 i = 0; i < leaves.length; i++) {
            subTrees[subTreeIndex][index] = leaves[i];
            if (index < subTreeSize - 1) {
                index += 1;
            } else {
                index = 0;
                subTreeIndex += 1;
            }
        }
    }

    function merge(
        bytes32 base,
        uint256 subTreeDepth,
        bytes32[] memory leaves
    ) internal pure returns (bytes32) {
        uint256[] memory uintLeaves;
        assembly {
            uintLeaves := leaves
        }
        return merge(base, subTreeDepth, uintLeaves);
    }

    function merge(
        bytes32 base,
        uint256 subTreeDepth,
        uint256[] memory leaves
    ) internal pure returns (bytes32) {
        uint256[][] memory subTrees = splitToSubTrees(leaves, subTreeDepth);
        return merge(base, subTrees);
    }

    function merge(bytes32 base, uint256[][] memory subTrees)
        internal
        pure
        returns (bytes32)
    {
        bytes32[] memory subTreeHashes = new bytes32[](subTrees.length);
        for (uint256 i = 0; i < subTrees.length; i++) {
            subTreeHashes[i] = keccak256(abi.encodePacked(subTrees[i]));
        }
        bytes32 merged = base;
        for (uint256 i = 0; i < subTreeHashes.length; i++) {
            merged = keccak256(abi.encodePacked(merged, subTreeHashes[i]));
        }
        return merged;
    }

    /**
     * @param siblings If the merkle tree depth is "D" and the subTree's
     *          depth is "d", the length of the siblings should be "D - d".
     */
    function emptySubTreeProof(
        Hasher memory self,
        uint256 root,
        uint256 index,
        uint256 subTreeDepth,
        uint256[] memory siblings
    ) internal pure returns (bool) {
        uint256 subTreePath = index >> subTreeDepth;
        uint256 path = subTreePath;
        for (uint256 i = 0; i < siblings.length; i++) {
            if (path % 2 == 0) {
                // Right sibling should be a prehashed zero
                if (siblings[i] != self.preHashedZero[i + subTreeDepth])
                    return false;
            } else {
                // Left sibling should not be a prehashed zero
                if (siblings[i] == self.preHashedZero[i + subTreeDepth])
                    return false;
            }
            path >>= 1;
        }
        return
            self.merkleProof(
                root,
                self.preHashedZero[subTreeDepth],
                subTreePath,
                siblings
            );
    }

    function appendSubTree(
        Hasher memory self,
        uint256 index,
        uint256 subTreeDepth,
        uint256[] memory leaves,
        uint256[] memory siblings
    )
        internal
        pure
        returns (
            uint256 nextRoot,
            uint256 nextIndex,
            uint256[] memory nextSiblings
        )
    {
        uint256 subTreeSize = 1 << subTreeDepth;
        require(leaves.length <= subTreeSize, "Overflowed");
        nextSiblings = new uint256[](siblings.length);
        uint256 subTreePath = index >> subTreeDepth;
        uint256 path = subTreePath;
        uint256 node = _subTreeRoot(self, subTreeDepth, leaves);
        for (uint256 i = 0; i < siblings.length; i++) {
            if (path % 2 == 0) {
                // right empty sibling
                nextSiblings[i] = node; // current node will be the next merkle proof's left sibling
                node = self.parentOf(
                    node,
                    self.preHashedZero[i + subTreeDepth]
                );
            } else {
                // left sibling
                nextSiblings[i] = siblings[i]; // keep current sibling
                node = self.parentOf(siblings[i], node);
            }
            path >>= 1;
        }
        nextRoot = node;
        nextIndex = index + (1 << subTreeDepth);
    }

    function _subTreeRoot(
        Hasher memory self,
        uint256 subTreeDepth,
        uint256[] memory leaves
    ) private pure returns (uint256) {
        // Example of a sub tree with depth 3
        //                      1
        //          10                       11
        //    100        101         110           [111]
        // 1000 1001  1010 1011   1100 [1101]  [1110] [1111]
        //   o   o     o    o       o    x       x       x
        //
        // whereEmptyNodeStart (1101) = leaves.length + tree_size
        // []: nodes that we can use the pre hashed zeroes
        //
        // * ([1101] << 0) is gte than (1101) => we can use the pre hashed zeroes
        // * ([1110] << 0) is gte than (1101) => we can use the pre hashed zeroes
        // * ([1111] << 0) is gte than (1101) => we can use pre hashed zeroes
        // * ([111] << 1) is gte than (1101) => we can use pre hashed zeroes
        // * (11 << 2) is less than (1101) => we cannot use pre hashed zeroes
        // * (1 << 3) is less than (1101) => we cannot use pre hashed zeroes

        uint256 treeSize = 1 << subTreeDepth;
        require(leaves.length <= treeSize, "Overflowed");

        uint256[] memory nodes = new uint256[](treeSize << 1); // we'll not use nodes[0]
        uint256 lastNotEmptyNode = treeSize + leaves.length - 1;

        // From the bottom to the top
        for (uint256 level = 0; level <= subTreeDepth; level++) {
            uint256 leftMostOfTheFloor = treeSize >> level;
            // From the right to the left
            for (
                uint256 nodeIndex = (leftMostOfTheFloor << 1) - 1;
                nodeIndex >= leftMostOfTheFloor;
                nodeIndex--
            ) {
                if (nodeIndex <= lastNotEmptyNode) {
                    // This node is not an empty node
                    if (level == 0) {
                        // Leaf node
                        nodes[nodeIndex] = leaves[nodeIndex - treeSize];
                    } else {
                        // Parent node
                        uint256 leftChild = nodeIndex << 1;
                        uint256 rightChild = leftChild + 1;
                        nodes[nodeIndex] = self.parentOf(
                            nodes[leftChild],
                            nodes[rightChild]
                        );
                    }
                } else {
                    // Use pre hashed
                    nodes[nodeIndex] = self.preHashedZero[level];
                }
            }
            lastNotEmptyNode >>= 1;
        }
        return nodes[1];
    }
}

library OPRUVerifier {
    using MerkleTreeLib for bytes32;
    using SubTreeLib for Hasher;
    using SubTreeLib for uint256[];
    using SubTreeLib for bytes32;

    /**
     * @dev It verifies the initial sibling only once and then store the data on chain.
     *      This is usually appropriate for expensive hash functions like MiMC or Poseidon.
     */
    function initWithSiblings(
        TreeUpdateProof storage self,
        Hasher memory hasher,
        uint256 startingRoot,
        uint256 index,
        uint256 subTreeDepth,
        uint256[] memory subTreeSiblings
    ) internal {
        require(
            hasher.emptySubTreeProof(
                startingRoot,
                index,
                subTreeDepth,
                subTreeSiblings
            ),
            "Can't merge a subTree"
        );
        self.opru.start.root = startingRoot;
        self.opru.result.root = startingRoot;
        self.opru.start.index = index;
        self.opru.result.index = index;
        self.opru.mergedLeaves = bytes32(0);
        self.cachedSiblings = subTreeSiblings;
    }

    /**
     * @dev Construct a sub tree and insert into the merkle tree using the
     *      calldata provided sibling data. This is usually appropriate for
     *      keccak or other cheap hash functions.
     * @param self The TreeUpdateProof to update
     * @param leaves Items to append to the tree.
     */
    function update(
        TreeUpdateProof storage self,
        Hasher memory hasher,
        uint256 subTreeDepth,
        uint256[] memory subTreeSiblings,
        uint256[] memory leaves
    ) internal {
        require(
            hasher.emptySubTreeProof(
                self.opru.result.root,
                self.opru.result.index,
                subTreeDepth,
                subTreeSiblings
            ),
            "Can't merge a subTree"
        );
        uint256[] memory nextSiblings = subTreeSiblings;
        uint256 nextIndex = self.opru.result.index;
        uint256[][] memory subTrees = leaves.splitToSubTrees(subTreeDepth);
        uint256 newRoot;
        for (uint256 i = 0; i < subTrees.length; i++) {
            (newRoot, nextIndex, nextSiblings) = hasher.appendSubTree(
                nextIndex,
                subTreeDepth,
                subTrees[i],
                nextSiblings
            );
        }
        self.opru.result.root = newRoot;
        self.opru.result.index = nextIndex;
        self.opru.mergedLeaves = self.opru.mergedLeaves.merge(subTrees);
    }

    /**
     * @dev Construct a sub tree and insert into the merkle tree using the on-chain sibling data.
     *      You can use this function when only you started the TreeUpdateProof using
     *      initSubTreeRollUpWithSiblings()
     * @param self The TreeUpdateProof to update
     * @param leaves Items to append to the tree.
     */
    function update(
        TreeUpdateProof storage self,
        Hasher memory hasher,
        uint256 subTreeDepth,
        uint256[] memory leaves
    ) internal {
        uint256 nextIndex = self.opru.result.index;
        uint256[] memory nextSiblings = self.cachedSiblings;
        uint256[][] memory subTrees = leaves.splitToSubTrees(subTreeDepth);
        uint256 newRoot;
        for (uint256 i = 0; i < subTrees.length; i++) {
            (newRoot, nextIndex, nextSiblings) = hasher.appendSubTree(
                nextIndex,
                subTreeDepth,
                subTrees[i],
                nextSiblings
            );
        }
        self.opru.result.root = newRoot;
        self.opru.result.index = nextIndex;
        self.opru.mergedLeaves = self.opru.mergedLeaves.merge(subTrees);
        for (uint256 i = 0; i < nextSiblings.length; i++) {
            self.cachedSiblings[i] = nextSiblings[i];
        }
    }

    /**
     * @dev Check that the given optimistic roll up is valid using the
     *      on-chain calculated roll up.
     */
    function verify(TreeUpdateProof memory self, OPRU memory opru)
        internal
        pure
        returns (bool)
    {
        require(
            self.opru.start.root == opru.start.root,
            "Starting root is different"
        );
        require(
            self.opru.start.index == opru.start.index,
            "Starting index is different"
        );
        require(
            self.opru.mergedLeaves == opru.mergedLeaves,
            "Appended leaves are different"
        );
        require(
            self.opru.result.index == opru.result.index,
            "Result index is different"
        );
        return self.opru.result.root == opru.result.root;
    }
}
