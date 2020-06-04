pragma solidity >= 0.6.0;

struct Hasher {
    function (uint, uint) internal pure returns (uint) parentOf;
    uint[] preHashedZero;
}

struct Tree {
    uint root;
    uint index;
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
    uint[] siblings;
}

library RollUpLib {
    function rollUp(
        Hasher memory self,
        uint startingRoot,
        uint index,
        uint[] memory leaves,
        uint[] memory initialSiblings
    ) internal pure returns (uint newRoot) {
        require(_startingLeafProof(self, startingRoot, index, initialSiblings), "Invalid merkle proof of starting leaf node");
        uint nextIndex = index;
        uint[] memory nextSiblings = initialSiblings;
        for(uint i = 0; i < leaves.length; i++) {
            (newRoot, nextIndex, nextSiblings) = _append(self, nextIndex, leaves[i], nextSiblings);
        }
    }

    function merkleProof(
        Hasher memory self,
        uint root,
        uint leaf,
        uint index,
        uint[] memory siblings
    ) internal pure returns (bool) {
        return merkleRoot(self, leaf, index, siblings) == root;
    }

    function merkleRoot(
        Hasher memory self,
        uint leaf,
        uint index,
        uint[] memory siblings
    ) internal pure returns (uint) {
        uint path = index;
        uint node = leaf;
        for(uint i = 0; i < siblings.length; i++) {
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
        uint startingRoot,
        uint startingIndex,
        uint resultRoot,
        uint[] memory leaves
    ) internal pure returns (OPRU memory opru) {
        opru.start.root = startingRoot;
        opru.start.index = startingIndex;
        opru.result.root = resultRoot;
        opru.result.index = startingIndex + leaves.length;
        opru.mergedLeaves = merge(bytes32(0), leaves);
    }

    function newSplitRollUp(
        uint startingRoot,
        uint index
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
        uint startingRoot,
        uint index
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
        uint startingRoot,
        uint index,
        uint[] memory initialSiblings
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
        uint[] memory initialSiblings,
        uint[] memory leaves
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
        uint[] memory leaves
    ) internal {
        require(
            self.siblings.length != 0,
            "The on-chain siblings are not initialized"
        );
        uint nextIndex = self.result.index;
        uint[] memory nextSiblings = self.siblings;
        uint newRoot;
        for(uint i = 0; i < leaves.length; i++) {
            (newRoot, nextIndex, nextSiblings) = _append(hasher, nextIndex, leaves[i], nextSiblings);
        }
        bytes32 mergedLeaves = merge(self.mergedLeaves, leaves);
        self.result.root = newRoot;
        self.result.index = nextIndex;
        self.mergedLeaves = mergedLeaves;
        for(uint i = 0; i < nextSiblings.length; i++) {
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
    function merge(bytes32 base, uint[] memory leaves) internal pure returns (bytes32) {
        bytes32 merged = base;
        for(uint i = 0; i < leaves.length; i ++) {
            merged = keccak256(abi.encodePacked(merged, leaves[i]));
        }
        return merged;
    }

    function merge(bytes32 base, bytes32[] memory leaves) internal pure returns (bytes32) {
        bytes32 merged = base;
        for(uint i = 0; i < leaves.length; i ++) {
            merged = keccak256(abi.encodePacked(merged, leaves[i]));
        }
        return merged;
    }

    function _startingLeafProof(
        Hasher memory self,
        uint root,
        uint index,
        uint[] memory siblings
    ) internal pure returns (bool) {
        uint path = index;
        for(uint i = 0; i < siblings.length; i++) {
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
        uint index,
        uint leaf,
        uint[] memory siblings
    ) internal pure returns(
        uint nextRoot,
        uint nextIndex,
        uint[] memory nextSiblings
    ) {
        nextSiblings = new uint[](siblings.length);
        uint path = index;
        uint node = leaf;
        for(uint level = 0; level < siblings.length; level++) {
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
        uint startingRoot,
        uint index,
        uint subTreeDepth,
        uint[] memory leaves,
        uint[] memory subTreeSiblings
    ) internal pure returns (uint newRoot) {
        require(index % (1 << subTreeDepth) == 0, "Can't merge a subTree");
        require(_emptySubTreeProof(self, startingRoot, index, subTreeDepth, subTreeSiblings), "Can't merge a sub tree");
        uint nextIndex = index;
        uint[][] memory subTrees = splitToSubTrees(leaves, subTreeDepth);
        uint[] memory nextSiblings = subTreeSiblings;
        for(uint i = 0; i < subTrees.length; i++) {
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
        uint startingRoot,
        uint startingIndex,
        uint resultRoot,
        uint subTreeDepth,
        uint[] memory leaves
    ) internal pure returns (OPRU memory opru) {
        uint subTreeSize = 1 << subTreeDepth;
        opru.start.root = startingRoot;
        opru.start.index = startingIndex;
        opru.result.root = resultRoot;
        opru.result.index = startingIndex + subTreeSize*((leaves.length / subTreeSize) + (leaves.length % subTreeSize == 0 ? 0 : 1));
        uint[][] memory subTrees = splitToSubTrees(leaves, subTreeDepth);
        opru.mergedLeaves = merge(bytes32(0), subTrees);
    }

    function init(
        SplitRollUp storage self,
        uint startingRoot,
        uint index
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
        uint startingRoot,
        uint index,
        uint subTreeDepth,
        uint[] memory subTreeSiblings
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
        uint subTreeDepth,
        uint[] memory subTreeSiblings,
        uint[] memory leaves
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
        uint[] memory nextSiblings = subTreeSiblings;
        uint nextIndex = self.result.index;
        uint[][] memory subTrees = splitToSubTrees(leaves, subTreeDepth);
        uint newRoot;
        for(uint i = 0; i < subTrees.length; i++) {
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
        uint subTreeDepth,
        uint[] memory leaves
    ) internal {
        uint nextIndex = self.result.index;
        uint[] memory nextSiblings = self.siblings;
        uint[][] memory subTrees = splitToSubTrees(leaves, subTreeDepth);
        uint newRoot;
        for(uint i = 0; i < subTrees.length; i++) {
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
        for(uint i = 0; i < nextSiblings.length; i++) {
            self.siblings[i] = nextSiblings[i];
        }
    }

    function splitToSubTrees(
        uint[] memory leaves,
        uint subTreeDepth
    ) internal pure returns (uint[][] memory subTrees) {
        uint subTreeSize = 1 << subTreeDepth;
        uint numOfSubTrees = (leaves.length / subTreeSize) + (leaves.length % subTreeSize == 0 ? 0 : 1);
        subTrees = new uint[][](numOfSubTrees);
        for (uint i = 0; i < numOfSubTrees; i++) {
            subTrees[i] = new uint[](subTreeSize);
        }
        uint index = 0;
        uint subTreeIndex = 0;
        for(uint i = 0; i < leaves.length; i++) {
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

    function merge(bytes32 base, uint subTreeDepth, bytes32[] memory leaves) internal pure returns (bytes32) {
        uint[] memory uintLeaves;
        assembly {
            uintLeaves := leaves
        }
        return merge(base, subTreeDepth, uintLeaves);
    }

    function merge(bytes32 base, uint subTreeDepth, uint[] memory leaves) internal pure returns (bytes32) {
        uint[][] memory subTrees = splitToSubTrees(leaves, subTreeDepth);
        return merge(base, subTrees);
    }

    function merge(bytes32 base, uint[][] memory subTrees) internal pure returns (bytes32) {
        bytes32[] memory subTreeHashes = new bytes32[](subTrees.length);
        for(uint i = 0; i < subTrees.length; i++) {
            subTreeHashes[i] = keccak256(abi.encodePacked(subTrees[i]));
        }
        return RollUpLib.merge(base, subTreeHashes);
    }

    function mergeResult(uint[] memory leaves, uint subTreeDepth) internal pure returns (
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
        uint root,
        uint index,
        uint subTreeDepth,
        uint[] memory siblings
    ) internal pure returns (bool) {
        uint subTreePath = index >> subTreeDepth;
        uint path = subTreePath;
        for(uint i = 0; i < siblings.length; i++) {
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
        uint index,
        uint subTreeDepth,
        uint[] memory subTreeHashes,
        uint[] memory siblings
    ) internal pure returns(
        uint nextRoot,
        uint nextIndex,
        uint[] memory nextSiblings
    ) {
        nextSiblings = new uint[](siblings.length);
        uint subTreePath = index >> subTreeDepth;
        uint path = subTreePath;
        uint node = _subTreeRoot(self, subTreeDepth, subTreeHashes);
        for (uint i = 0; i < siblings.length; i++) {
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
        uint subTreeDepth,
        uint[] memory leaves
    ) internal pure returns (uint) {
        /// Example of a sub tree with depth 3
        ///                      1
        ///          10                       11
        ///    100        101         110           [111]
        /// 1000 1001  1010 1011   1100 [1101]  [1110] [1111]
        ///   o   o     o    o       o    x       x       x
        ///
        /// whereEmptyNodeStart (1101) = leaves.length + tree_size
        /// []: nodes that we can use the pre hashed zeroes
        ///
        /// * ([1101] << 0) is gte than (1101) => we can use the pre hashed zeroes
        /// * ([1110] << 0) is gte than (1101) => we can use the pre hashed zeroes
        /// * ([1111] << 0) is gte than (1101) => we can use pre hashed zeroes
        /// * ([111] << 1) is gte than (1101) => we can use pre hashed zeroes
        /// * (11 << 2) is less than (1101) => we cannot use pre hashed zeroes
        /// * (1 << 3) is less than (1101) => we cannot use pre hashed zeroes

        uint treeSize = 1 << subTreeDepth;
        require(leaves.length <= treeSize, "Overflowed");

        uint[] memory nodes = new uint[](treeSize << 1); /// we'll not use nodes[0]
        uint emptyNode = treeSize + (leaves.length - 1); /// we do not hash if we can use pre hashed zeroes
        uint leftMostOfTheFloor = treeSize;

        /// From the bottom to the top
        for(uint level = 0; level <= subTreeDepth; level++) {
            /// From the right to the left
            for(
                uint nodeIndex = (treeSize << 1) - 1;
                nodeIndex >= leftMostOfTheFloor;
                nodeIndex--
            )
            {
                if (nodeIndex <= emptyNode) {
                    /// This node is not an empty node
                    if (level == 0) {
                        /// Leaf node
                        nodes[nodeIndex] = leaves[nodeIndex - treeSize];
                    } else {
                        /// Parent node
                        uint leftChild = nodeIndex << 1;
                        uint rightChild = leftChild + 1;
                        nodes[nodeIndex] = self.parentOf(nodes[leftChild], nodes[rightChild]);
                    }
                } else {
                    /// Use pre hashed
                    nodes[nodeIndex] = self.preHashedZero[level];
                }
            }
            leftMostOfTheFloor >>= 1;
            emptyNode >>= 1;
        }
    }
}