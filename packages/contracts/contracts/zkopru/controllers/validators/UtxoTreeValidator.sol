// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import { Storage } from "../../storage/Storage.sol";
import { SubTreeLib } from "../../libraries/MerkleTree.sol";
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
import { IUtxoTreeValidator } from "../../interfaces/validators/IUtxoTreeValidator.sol";

contract UtxoTreeValidator is Storage, IUtxoTreeValidator {
    using Types for Outflow;
    using Types for Header;

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
    )
    external
    pure
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        // This will revert when the submitted deposit data does not match with the block
        require(_checkSubmittedDeposits(_block, _deposits), "Submitted invalid deposits");
        // This will revert when the submitted header data does not match with the block
        Header memory parentHeader = Deserializer.headerFromCalldataAt(1);
        require(_block.header.parentBlock == parentHeader.hash(), "Invalid prev header");
        // Add the deposit lengths to the utxo first
        uint256 utxoLen = _deposits.length;
        // Append UTXOs from transactions
        for (uint256 i = 0; i < _block.body.txs.length; i++) {
            for(uint256 j = 0; j < _block.body.txs[i].outflow.length; j++) {
                if(_block.body.txs[i].outflow[j].isUTXO()) {
                    utxoLen += 1;
                }
            }
        }
        uint256 numOfSubTrees = utxoLen / UTXO_SUB_TREE_SIZE + (utxoLen % UTXO_SUB_TREE_SIZE != 0 ? 1 : 0);
        uint256 nextIndex = parentHeader.utxoIndex + UTXO_SUB_TREE_SIZE * numOfSubTrees;
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
    )
    external
    pure
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        // This will revert when the submitted deposit data does not match with the block
        require(_checkSubmittedDeposits(_block, _deposits), "Submitted invalid deposits");
        // This will revert when the submitted header data does not match with the block
        Header memory parentHeader = Deserializer.headerFromCalldataAt(1);
        require(_block.header.parentBlock == parentHeader.hash(), "Invalid prev header");
        // Get utxos
        uint256[] memory utxos = _getUTXOs(_deposits, _block.body.txs);
        // Check validity of the roll up using the storage based Poseidon sub-tree roll up
        uint256 computedRoot = SubTreeLib.appendSubTree(
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

    function _checkSubmittedDeposits(
        Block memory _block,
        uint256[] memory deposits
    )
        internal
        pure
        returns (bool)
    {
        // Check submitted deposits are equal to the leaves in the MassDeposits
        uint256 depositIndex = 0;
        for(uint256 i = 0; i < _block.body.massDeposits.length; i++) {
            bytes32 merged = bytes32(0);
            while(merged != _block.body.massDeposits[i].merged) {
                // merge deposits until it matches with the submitted mass deposit's merged leaves.
                merged = keccak256(abi.encodePacked(merged, deposits[depositIndex]));
                depositIndex++;
                if (depositIndex > deposits.length) return false;
            }
        }
        return depositIndex == deposits.length;
    }

    function _getUTXOs(
        uint256[] memory deposits,
        Transaction[] memory txs
    ) private pure returns (uint256[] memory utxos) {
        // Calculate the length of the utxo array
        uint256 numOfUTXOs = deposits.length;
        for (uint256 i = 0; i < txs.length; i++) {
            Transaction memory transaction = txs[i];
            for(uint256 j = 0; j < transaction.outflow.length; j++) {
                if(transaction.outflow[j].isUTXO()) {
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
            for(uint256 j = 0; j < transaction.outflow.length; j++) {
                if(transaction.outflow[j].isUTXO()) {
                    utxos[index++] = transaction.outflow[j].note;
                }
            }
        }
    }
}
