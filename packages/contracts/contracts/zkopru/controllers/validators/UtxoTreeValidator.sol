// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.7.4;

import { Storage } from "../../storage/Storage.sol";
import {
    SubTreeLib,
    OPRU,
    TreeSnapshot,
    TreeUpdateProof,
    OPRUVerifier
} from "../../libraries/MerkleTree.sol";
import { Hash } from "../../libraries/Hash.sol";
import {
    Block,
    Transaction,
    Outflow,
    MassDeposit,
    OutflowType,
    Header,
    Types
} from "../../libraries/Types.sol";
import { Deserializer } from "../../libraries/Deserializer.sol";
import {
    IUtxoTreeValidator
} from "../../interfaces/validators/IUtxoTreeValidator.sol";

contract UtxoTreeValidator is Storage, IUtxoTreeValidator {
    using Types for Outflow;
    using Types for Header;
    using OPRUVerifier for TreeUpdateProof;

    event NewProof(uint256 id, uint256 root, uint256 index);
    event ProofUpdated(
        uint256 id,
        uint256 startRoot,
        uint256 startIndex,
        uint256 resultRoot,
        uint256 resultIndex
    );

    function newProof(
        uint256 proofId,
        uint256 startingRoot,
        uint256 startingIndex,
        uint256[] memory initialSiblings
    ) external override {
        TreeUpdateProof storage proof = Storage.utxoTreeProofs[proofId];
        require(proof.owner == address(0), "Already exists");
        proof.initWithSiblings(
            Hash.poseidon(),
            startingRoot,
            startingIndex,
            UTXO_SUB_TREE_DEPTH,
            initialSiblings
        );
        proof.owner = msg.sender;
        emit NewProof(proofId, startingRoot, startingIndex);
    }

    /**
     * @dev Update the stored intermediate update result by appending given leaves.
     *      Only the creator is allowed to append new leaves.
     */
    function updateProof(uint256 proofId, uint256[] memory leaves)
        external
        override
    {
        TreeUpdateProof storage proof = Storage.utxoTreeProofs[proofId];
        require(
            proof.owner == msg.sender,
            "Not permitted to update the given proof"
        );
        proof.update(Hash.poseidon(), UTXO_SUB_TREE_DEPTH, leaves);
        emit ProofUpdated(
            proofId,
            proof.opru.start.root,
            proof.opru.start.index,
            proof.opru.result.root,
            proof.opru.result.index
        );
    }

    /**
     * @dev Challenge when the submitted block's updated utxo tree index is invalid.
     * @param // blockData Serialized block data
     * @param // parentHeader Serialized details of its parent header
     * @param _deposits Submit all deposit leaves to be merged.
     */
    function validateUTXOIndex(
        bytes calldata, // blockData
        bytes calldata, // parentHeader
        uint256[] calldata _deposits
    ) external pure override returns (bool slash, string memory reason) {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        // This will revert when the submitted deposit data does not match with the block
        require(
            _checkSubmittedDeposits(_block, _deposits),
            "Submitted invalid deposits"
        );
        // This will revert when the submitted header data does not match with the block
        Header memory parentHeader = Deserializer.headerFromCalldataAt(1);
        require(
            _block.header.parentBlock == parentHeader.hash(),
            "Invalid prev header"
        );
        // Add the deposit lengths to the utxo first
        uint256 utxoLen = _deposits.length;
        // Append UTXOs from transactions
        for (uint256 i = 0; i < _block.body.txs.length; i++) {
            for (uint256 j = 0; j < _block.body.txs[i].outflow.length; j++) {
                if (_block.body.txs[i].outflow[j].isUTXO()) {
                    utxoLen += 1;
                }
            }
        }
        uint256 numOfSubTrees =
            utxoLen /
                UTXO_SUB_TREE_SIZE +
                (utxoLen % UTXO_SUB_TREE_SIZE != 0 ? 1 : 0);
        uint256 nextIndex =
            parentHeader.utxoIndex + UTXO_SUB_TREE_SIZE * numOfSubTrees;
        if (nextIndex != _block.header.utxoIndex) {
            // code U1: The updated number of total UTXO is not correct.
            return (true, "U1");
        } else if (nextIndex > MAX_UTXO) {
            // code U1: The updated number of total UTXO is not correct.
            return (true, "U2");
        }
    }

    /**
     * @dev Challenge when the submitted block's updated utxo tree root is invalid.
     * @param // block Serialized block data
     * @param // parentHeader Serialized details of its parent header
     * @param _deposits Submit all deposit leaves to be merged.
     * @param _subTreeSiblings Submit the siblings of the starting index leaf
     */
    function validateUTXORoot(
        bytes calldata, // blockData
        bytes calldata, // parentHeader
        uint256[] calldata _deposits,
        uint256[] calldata _subTreeSiblings
    ) external pure override returns (bool slash, string memory reason) {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        // This will revert when the submitted deposit data does not match with the block
        require(
            _checkSubmittedDeposits(_block, _deposits),
            "Submitted invalid deposits"
        );
        // This will revert when the submitted header data does not match with the block
        Header memory parentHeader = Deserializer.headerFromCalldataAt(1);
        require(
            _block.header.parentBlock == parentHeader.hash(),
            "Invalid prev header"
        );
        // Get utxos
        uint256[] memory utxos = _getUTXOs(_deposits, _block.body.txs);
        // Check validity of the roll up using the storage based Poseidon sub-tree roll up
        uint256 computedRoot =
            SubTreeLib.append(
                Hash.poseidon(),
                parentHeader.utxoRoot,
                parentHeader.utxoIndex,
                UTXO_SUB_TREE_DEPTH,
                utxos,
                _subTreeSiblings
            );
        // Computed new utxo root is different with the submitted
        // code U3: The updated utxo tree root is not correct.
        return (computedRoot != _block.header.utxoRoot, "U3");
    }

    /**
     * @dev Challenge when the submitted block's updated utxo tree root is invalid.
     * @param // block Serialized block data
     * @param // parentHeader Serialized details of its parent header
     * @param _deposits Submit all deposit leaves to be merged.
     */
    function validateUTXORootWithProof(
        bytes calldata, // blockData
        bytes calldata, // parentHeader
        uint256[] calldata _deposits,
        uint256 proofId
    ) external view override returns (bool slash, string memory reason) {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        // This will revert when the submitted deposit data does not match with the block
        require(
            _checkSubmittedDeposits(_block, _deposits),
            "Submitted invalid deposits"
        );
        // This will revert when the submitted header data does not match with the block
        Header memory parentHeader = Deserializer.headerFromCalldataAt(1);
        require(
            _block.header.parentBlock == parentHeader.hash(),
            "Invalid prev header"
        );
        // Get utxos
        uint256[] memory utxos = _getUTXOs(_deposits, _block.body.txs);

        OPRU memory opru =
            OPRU(
                TreeSnapshot(parentHeader.utxoRoot, parentHeader.utxoIndex),
                TreeSnapshot(_block.header.utxoRoot, _block.header.utxoIndex),
                SubTreeLib.merge(bytes32(0), UTXO_SUB_TREE_DEPTH, utxos)
            );

        TreeUpdateProof storage proof = Storage.utxoTreeProofs[proofId];
        require(proof.owner == msg.sender, "Proof owner already spent gas.");
        bool verifyResult = proof.verify(opru);
        // Computed new utxo root is different with the submitted
        // code U3: The updated utxo tree root is not correct.
        return (!verifyResult, "U3");
    }

    function getProof(uint256 proofId)
        external
        view
        override
        returns (
            address owner,
            uint256 startRoot,
            uint256 startIndex,
            uint256 resultRoot,
            uint256 resultIndex,
            bytes32 mergedLeaves,
            uint256[] memory cachedSiblings
        )
    {
        TreeUpdateProof storage proof = Storage.utxoTreeProofs[proofId];
        owner = proof.owner;
        startRoot = proof.opru.start.root;
        startIndex = proof.opru.start.index;
        resultRoot = proof.opru.result.root;
        resultIndex = proof.opru.result.index;
        mergedLeaves = proof.opru.mergedLeaves;
        cachedSiblings = proof.cachedSiblings;
    }

    function _checkSubmittedDeposits(
        Block memory _block,
        uint256[] memory deposits
    ) internal pure returns (bool) {
        // Check submitted deposits are equal to the leaves in the MassDeposits
        uint256 depositIndex = 0;
        for (uint256 i = 0; i < _block.body.massDeposits.length; i++) {
            bytes32 merged = bytes32(0);
            while (merged != _block.body.massDeposits[i].merged) {
                // merge deposits until it matches with the submitted mass deposit's merged leaves.
                merged = keccak256(
                    abi.encodePacked(merged, deposits[depositIndex])
                );
                depositIndex++;
                if (depositIndex > deposits.length) return false;
            }
        }
        return depositIndex == deposits.length;
    }

    function _getUTXOs(uint256[] memory deposits, Transaction[] memory txs)
        internal
        pure
        returns (uint256[] memory utxos)
    {
        // Calculate the length of the utxo array
        uint256 numOfUTXOs = deposits.length;
        for (uint256 i = 0; i < txs.length; i++) {
            Transaction memory transaction = txs[i];
            for (uint256 j = 0; j < transaction.outflow.length; j++) {
                if (transaction.outflow[j].isUTXO()) {
                    numOfUTXOs++;
                }
            }
        }
        // Make the utxo array
        utxos = new uint256[](numOfUTXOs);
        uint256 index = 0;
        // Append deposits first
        for (uint256 i = 0; i < deposits.length; i++) {
            utxos[index++] = deposits[i];
        }
        // Append UTXOs from transactions
        for (uint256 i = 0; i < txs.length; i++) {
            Transaction memory transaction = txs[i];
            for (uint256 j = 0; j < transaction.outflow.length; j++) {
                if (transaction.outflow[j].isUTXO()) {
                    utxos[index++] = transaction.outflow[j].note;
                }
            }
        }
    }
}
