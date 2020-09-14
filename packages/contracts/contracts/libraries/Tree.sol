// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

struct Hasher {
    function (uint256, uint256) internal pure returns (uint256) parentOf;
    uint256[] preHashedZero;
}

struct Tree {
    uint256 root;
    uint256 index;
}

struct OPRU {
    Tree start;
    Tree result;
    bytes32 mergedLeaves;
}

struct SplitRollUp {
    Tree start;
    Tree result;
    bytes32 mergedLeaves;
    uint256[] siblings;
}

library RollUpLib {
    function rollUp(
        Hasher memory self,
        uint256 startingRoot,
        uint256 index,
        uint256[] memory leaves,
        uint256[] memory initialSiblings
    ) internal pure returns (uint256 newRoot) {
        require(_startingLeafProof(self, startingRoot, index, initialSiblings), "Invalid merkle proof of starting leaf node");
        uint256 nextIndex = index;
        uint256[] memory nextSiblings = initialSiblings;
        for(uint256 i = 0; i < leaves.length; i++) {
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
        for(uint256 i = 0; i < siblings.length; i++) {
            if(path & 1 == 0) {
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

    /**
     * @dev It returns an initialized merkle tree which leaves are all empty.
     */
    function newTree(Hasher memory hasher) internal pure returns (Tree memory tree) {
        tree.root = hasher.preHashedZero[hasher.preHashedZero.length - 1];
        tree.index = 0;
    }

    function newOPRU(
        uint256 startingRoot,
        uint256 startingIndex,
        uint256 resultRoot,
        uint256[] memory leaves
    ) internal pure returns (OPRU memory opru) {
        opru.start.root = startingRoot;
        opru.start.index = startingIndex;
        opru.result.root = resultRoot;
        opru.result.index = startingIndex + leaves.length;
        opru.mergedLeaves = merge(bytes32(0), leaves);
    }

    function newSplitRollUp(
        uint256 startingRoot,
        uint256 index
    ) internal pure returns (SplitRollUp memory splitRollUp) {
        splitRollUp.start.root = startingRoot;
        splitRollUp.result.root = startingRoot;
        splitRollUp.start.index = index;
        splitRollUp.result.index = index;
        splitRollUp.mergedLeaves = bytes32(0);
        return splitRollUp;
    }

    function init(
        SplitRollUp storage self,
        uint256 startingRoot,
        uint256 index
    ) internal {
        self.start.root = startingRoot;
        self.result.root = startingRoot;
        self.start.index = index;
        self.result.index = index;
        self.mergedLeaves = bytes32(0);
    }

    /**
     * @dev If you start the split roll up using this function, you don't need to submit and verify
     *      the every time. Approximately, if the hash function is more expensive than 5,000 gas,
     *      it becomes to cheaper to record the intermediate siblings on-chain.
     *      To be specific, record intermediate siblings when v > 5000 + 20000/(n-1)
     *      v: gas cost of the hash function, n: how many times to call 'update'
     */
    function initWithSiblings(
        SplitRollUp storage self,
        Hasher memory hasher,
        uint256 startingRoot,
        uint256 index,
        uint256[] memory initialSiblings
    ) internal {
        require(_startingLeafProof(hasher, startingRoot, index, initialSiblings), "Invalid merkle proof of the starting leaf node");
        self.start.root = startingRoot;
        self.result.root = startingRoot;
        self.start.index = index;
        self.result.index = index;
        self.mergedLeaves = bytes32(0);
        self.siblings = initialSiblings;
    }

    /**
     * @dev Append given leaves to the SplitRollUp with verifying the siblings.
     * @param self The SplitRollUp to update
     * @param initialSiblings Initial siblings to start roll up.
     * @param leaves Items to append to the tree.
     */
    function update(
        SplitRollUp storage self,
        Hasher memory hasher,
        uint256[] memory initialSiblings,
        uint256[] memory leaves
    ) internal {
        self.result.root = rollUp(hasher, self.result.root, self.result.index, initialSiblings, leaves);
        self.result.index += leaves.length;
        self.mergedLeaves = merge(self.mergedLeaves, leaves);
    }

    /**
     * @dev Append the given leaves using the on-chain sibling data.
     *      You can use this function when only you started the SplitRollUp using
     *      initAndSaveSiblings()
     * @param self The SplitRollUp to update
     * @param leaves Items to append to the tree.
     */
    function update(
        SplitRollUp storage self,
        Hasher memory hasher,
        uint256[] memory leaves
    ) internal {
        require(
            self.siblings.length != 0,
            "The on-chain siblings are not initialized"
        );
        uint256 nextIndex = self.result.index;
        uint256[] memory nextSiblings = self.siblings;
        uint256 newRoot;
        for(uint256 i = 0; i < leaves.length; i++) {
            (newRoot, nextIndex, nextSiblings) = _append(hasher, nextIndex, leaves[i], nextSiblings);
        }
        bytes32 mergedLeaves = merge(self.mergedLeaves, leaves);
        self.result.root = newRoot;
        self.result.index = nextIndex;
        self.mergedLeaves = mergedLeaves;
        for(uint256 i = 0; i < nextSiblings.length; i++) {
            self.siblings[i] = nextSiblings[i];
        }
    }

    /**
     * @dev Check that the given optimistic roll up is valid using the
     *      on-chain calculated roll up.
     */
    function verify(
        SplitRollUp memory self,
        OPRU memory opru
    ) internal pure returns (bool) {
        require(self.start.root == opru.start.root, "Starting root is different");
        require(self.start.index == opru.start.index, "Starting index is different");
        require(self.mergedLeaves == opru.mergedLeaves, "Appended leaves are different");
        require(self.result.index == opru.result.index, "Result index is different");
        return self.result.root == opru.result.root;
    }

    /**
     * @dev Appended leaves will be merged into a single bytes32 value sequentially
     *      and that will be used to validate the correct sequence of the total
     *      appended leaves through multiple transactions.
     */
    function merge(bytes32 base, uint256[] memory leaves) internal pure returns (bytes32) {
        bytes32 merged = base;
        for(uint256 i = 0; i < leaves.length; i ++) {
            merged = keccak256(abi.encodePacked(merged, leaves[i]));
        }
        return merged;
    }

    function merge(bytes32 base, bytes32[] memory leaves) internal pure returns (bytes32) {
        bytes32 merged = base;
        for(uint256 i = 0; i < leaves.length; i ++) {
            merged = keccak256(abi.encodePacked(merged, leaves[i]));
        }
        return merged;
    }

    function _startingLeafProof(
        Hasher memory self,
        uint256 root,
        uint256 index,
        uint256[] memory siblings
    ) internal pure returns (bool) {
        uint256 path = index;
        for(uint256 i = 0; i < siblings.length; i++) {
            if(path & 1 == 0) {
                // Right sibling should be a prehashed zero
                if(siblings[i] != self.preHashedZero[i]) return false;
            } else {
                // Left sibling should not be a prehashed zero
                if(siblings[i] == self.preHashedZero[i]) return false;
            }
            path >>= 1;
        }
        return merkleProof(self, root, self.preHashedZero[0], index, siblings);
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
        for(uint256 level = 0; level < siblings.length; level++) {
            if(path & 1 == 0) {
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

library SubTreeRollUpLib {
    using RollUpLib for Hasher;
    using RollUpLib for bytes32;

    function rollUpSubTree(
        Hasher memory self,
        uint256 startingRoot,
        uint256 index,
        uint256 subTreeDepth,
        uint256[] memory leaves,
        uint256[] memory subTreeSiblings
    ) internal pure returns (uint256 newRoot) {
        require(index % (1 << subTreeDepth) == 0, "Can't merge a subTree");
        require(_emptySubTreeProof(self, startingRoot, index, subTreeDepth, subTreeSiblings), "Can't merge a sub tree");
        uint256 nextIndex = index;
        uint256[][] memory subTrees = splitToSubTrees(leaves, subTreeDepth);
        uint256[] memory nextSiblings = subTreeSiblings;
        for(uint256 i = 0; i < subTrees.length; i++) {
            (newRoot, nextIndex, nextSiblings) = _appendSubTree(
                self,
                nextIndex,
                subTreeDepth,
                subTrees[i],
                nextSiblings
            );
        }
    }

    function newSubTreeOPRU(
        uint256 startingRoot,
        uint256 startingIndex,
        uint256 resultRoot,
        uint256 subTreeDepth,
        uint256[] memory leaves
    ) internal pure returns (OPRU memory opru) {
        uint256 subTreeSize = 1 << subTreeDepth;
        opru.start.root = startingRoot;
        opru.start.index = startingIndex;
        opru.result.root = resultRoot;
        opru.result.index = startingIndex + subTreeSize*((leaves.length / subTreeSize) + (leaves.length % subTreeSize == 0 ? 0 : 1));
        uint256[][] memory subTrees = splitToSubTrees(leaves, subTreeDepth);
        opru.mergedLeaves = merge(bytes32(0), subTrees);
    }

    function init(
        SplitRollUp storage self,
        uint256 startingRoot,
        uint256 index
    ) internal {
        self.start.root = startingRoot;
        self.result.root = startingRoot;
        self.start.index = index;
        self.result.index = index;
        self.mergedLeaves = bytes32(0);
    }

    /**
     * @dev It verifies the initial sibling only once and then store the data on chain.
     *      This is usually appropriate for expensive hash functions like MiMC or Poseidon.
     */
    function initWithSiblings(
        SplitRollUp storage self,
        Hasher memory hasher,
        uint256 startingRoot,
        uint256 index,
        uint256 subTreeDepth,
        uint256[] memory subTreeSiblings
    ) internal {
        require(_emptySubTreeProof(hasher, startingRoot, index, subTreeDepth, subTreeSiblings), "Can't merge a subTree");
        self.start.root = startingRoot;
        self.result.root = startingRoot;
        self.start.index = index;
        self.result.index = index;
        self.mergedLeaves = bytes32(0);
        self.siblings = subTreeSiblings;
    }
    /**
     * @dev Construct a sub tree and insert into the merkle tree using the
     *      calldata provided sibling data. This is usually appropriate for
     *      keccak or other cheap hash functions.
     * @param self The SplitRollUp to update
     * @param leaves Items to append to the tree.
     */
    function update(
        SplitRollUp storage self,
        Hasher memory hasher,
        uint256 subTreeDepth,
        uint256[] memory subTreeSiblings,
        uint256[] memory leaves
    ) internal {
        require(
            _emptySubTreeProof(
                hasher,
                self.result.root,
                self.result.index,
                subTreeDepth,
                subTreeSiblings
            ),
            "Can't merge a subTree"
        );
        uint256[] memory nextSiblings = subTreeSiblings;
        uint256 nextIndex = self.result.index;
        uint256[][] memory subTrees = splitToSubTrees(leaves, subTreeDepth);
        uint256 newRoot;
        for(uint256 i = 0; i < subTrees.length; i++) {
            (newRoot, nextIndex, nextSiblings) = _appendSubTree(
                hasher,
                nextIndex,
                subTreeDepth,
                subTrees[i],
                nextSiblings
            );
        }
        self.result.root = newRoot;
        self.result.index = nextIndex;
        self.mergedLeaves = merge(self.mergedLeaves, subTrees);
    }

    /**
     * @dev Construct a sub tree and insert into the merkle tree using the on-chain sibling data.
     *      You can use this function when only you started the SplitRollUp using
     *      initSubTreeRollUpWithSiblings()
     * @param self The SplitRollUp to update
     * @param leaves Items to append to the tree.
     */
    function update(
        SplitRollUp storage self,
        Hasher memory hasher,
        uint256 subTreeDepth,
        uint256[] memory leaves
    ) internal {
        uint256 nextIndex = self.result.index;
        uint256[] memory nextSiblings = self.siblings;
        uint256[][] memory subTrees = splitToSubTrees(leaves, subTreeDepth);
        uint256 newRoot;
        for(uint256 i = 0; i < subTrees.length; i++) {
            (newRoot, nextIndex, nextSiblings) = _appendSubTree(
                hasher,
                nextIndex,
                subTreeDepth,
                subTrees[i],
                nextSiblings
            );
        }
        self.result.root = newRoot;
        self.result.index = nextIndex;
        self.mergedLeaves = merge(self.mergedLeaves, subTrees);
        for(uint256 i = 0; i < nextSiblings.length; i++) {
            self.siblings[i] = nextSiblings[i];
        }
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
        for(uint256 i = 0; i < leaves.length; i++) {
            subTrees[subTreeIndex][index] = leaves[i];
            if(index < subTreeSize - 1) {
                index += 1;
            } else {
                index = 0;
                subTreeIndex += 1;
            }
        }
    }

    function verify(
        SplitRollUp memory self,
        OPRU memory opru
    ) internal pure returns (bool) {
        return RollUpLib.verify(self, opru);
    }

    function merge(bytes32 base, uint256 subTreeDepth, bytes32[] memory leaves) internal pure returns (bytes32) {
        uint256[] memory uintLeaves;
        assembly {
            uintLeaves := leaves
        }
        return merge(base, subTreeDepth, uintLeaves);
    }

    function merge(bytes32 base, uint256 subTreeDepth, uint256[] memory leaves) internal pure returns (bytes32) {
        uint256[][] memory subTrees = splitToSubTrees(leaves, subTreeDepth);
        return merge(base, subTrees);
    }

    function merge(bytes32 base, uint256[][] memory subTrees) internal pure returns (bytes32) {
        bytes32[] memory subTreeHashes = new bytes32[](subTrees.length);
        for(uint256 i = 0; i < subTrees.length; i++) {
            subTreeHashes[i] = keccak256(abi.encodePacked(subTrees[i]));
        }
        return RollUpLib.merge(base, subTreeHashes);
    }

    function mergeResult(uint256[] memory leaves, uint256 subTreeDepth) internal pure returns (
        bytes32 mergedAsIndividuals,
        bytes32 mergedAsSubTrees
    )
    {
        return (
            RollUpLib.merge(bytes32(0), leaves),
            merge(bytes32(0), subTreeDepth, leaves)
        );
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
        for(uint256 i = 0; i < siblings.length; i++) {
            if(path & 1 == 0) {
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
        uint256[] memory subTreeHashes,
        uint256[] memory siblings
    ) internal pure returns(
        uint256 nextRoot,
        uint256 nextIndex,
        uint256[] memory nextSiblings
    ) {
        nextSiblings = new uint256[](siblings.length);
        uint256 subTreePath = index >> subTreeDepth;
        uint256 path = subTreePath;
        uint256 node = _subTreeRoot(self, subTreeDepth, subTreeHashes);
        for (uint256 i = 0; i < siblings.length; i++) {
            if (path & 1 == 0) {
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
        uint256 emptyNode = treeSize + (leaves.length - 1); // we do not hash if we can use pre hashed zeroes
        uint256 leftMostOfTheFloor = treeSize;

        // From the bottom to the top
        for(uint256 level = 0; level <= subTreeDepth; level++) {
            // From the right to the left
            for(
                uint256 nodeIndex = (treeSize << 1) - 1;
                nodeIndex >= leftMostOfTheFloor;
                nodeIndex--
            )
            {
                if (nodeIndex <= emptyNode) {
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
    }
}