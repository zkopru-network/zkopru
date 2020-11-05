// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";

struct Hasher {
    function (uint256, uint256) internal pure returns (uint256) parentOf;
    uint256[] preHashedZero;
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
        require(self.preHashedZero.length == initialSiblings.length + 1, "Submitted invalid length of siblings");
        require(_startingLeafProof(self, startingRoot, index, initialSiblings), "Invalid merkle proof of starting leaf node");
        uint256 nextIndex = index;
        uint256[] memory nextSiblings = initialSiblings;
        for (uint256 i = 0; i < leaves.length; i++) {
            (newRoot, nextIndex, nextSiblings) = _append(self, nextIndex, leaves[i], nextSiblings);
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

    function _startingLeafProof(
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

    function _append(
        Hasher memory self,
        uint256 index,
        uint256 leaf,
        uint256[] memory siblings
    ) internal pure returns(
        uint256 nextRoot,
        uint256 nextIndex,
        uint256[] memory nextSiblings
    ) {
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

    function appendSubTree(
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
            self.preHashedZero.length == subTreeDepth + subTreeSiblings.length + 1,
            "Should submit subtree's siblings"
        );
        require(_emptySubTreeProof(self, startingRoot, index, subTreeDepth, subTreeSiblings), "Insertion is not allowed");
        uint256 nextIndex = index;
        uint256[][] memory subTrees = splitToSubTrees(leaves, subTreeDepth);
        uint256[] memory nextSiblings = subTreeSiblings;
        for (uint256 i = 0; i < subTrees.length; i++) {
            (newRoot, nextIndex, nextSiblings) = _appendSubTree(
                self,
                nextIndex,
                subTreeDepth,
                subTrees[i],
                nextSiblings
            );
        }
        return newRoot;
    }

    function splitToSubTrees(
        uint256[] memory leaves,
        uint256 subTreeDepth
    ) internal pure returns (uint256[][] memory subTrees) {
        uint256 subTreeSize = 1 << subTreeDepth;
        uint256 numOfSubTrees = (leaves.length / subTreeSize) + (leaves.length % subTreeSize == 0 ? 0 : 1);
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

    /**
     * @param siblings If the merkle tree depth is "D" and the subTree's
     *          depth is "d", the length of the siblings should be "D - d".
     */
    function _emptySubTreeProof(
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
                if(siblings[i] != self.preHashedZero[i + subTreeDepth]) return false;
            } else {
                // Left sibling should not be a prehashed zero
                if(siblings[i] == self.preHashedZero[i + subTreeDepth]) return false;
            }
            path >>= 1;
        }
        return self.merkleProof(root, self.preHashedZero[subTreeDepth], subTreePath, siblings);
    }

    function _appendSubTree(
        Hasher memory self,
        uint256 index,
        uint256 subTreeDepth,
        uint256[] memory leaves,
        uint256[] memory siblings
    ) internal pure returns(
        uint256 nextRoot,
        uint256 nextIndex,
        uint256[] memory nextSiblings
    ) {
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
                node = self.parentOf(node, self.preHashedZero[i + subTreeDepth]);
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
    ) internal pure returns (uint256) {
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
        uint256 emptyNode = treeSize + leaves.length; // we do not hash if we can use pre hashed zeroes

        // From the bottom to the top
        for (uint256 level = 0; level <= subTreeDepth; level++) {
            uint256 leftMostOfTheFloor = treeSize >> level;
            // From the right to the left
            for (
                uint256 nodeIndex = (leftMostOfTheFloor << 1 ) - 1;
                nodeIndex >= leftMostOfTheFloor;
                nodeIndex--
            )
            {
                if (nodeIndex < emptyNode) {
                    // This node is not an empty node
                    if (level == 0) {
                        // Leaf node
                        nodes[nodeIndex] = leaves[nodeIndex - treeSize];
                    } else {
                        // Parent node
                        uint256 leftChild = nodeIndex << 1;
                        uint256 rightChild = leftChild + 1;
                        nodes[nodeIndex] = self.parentOf(nodes[leftChild], nodes[rightChild]);
                    }
                } else {
                    // Use pre hashed
                    nodes[nodeIndex] = self.preHashedZero[level];
                }
            }
            leftMostOfTheFloor >>= 1;
            emptyNode >>= 1;
        }
        return nodes[1];
    }
}