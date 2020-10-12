// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import { Layer2 } from "../../storage/Layer2.sol";
import { SubTreeRollUpLib } from "../../libraries/Tree.sol";
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

contract UtxoTreeValidator is Layer2, IUtxoTreeValidator {
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
    view
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        Header memory _parentHeader = Deserializer.headerFromCalldataAt(1);
        // This will revert when the submitted header and deposit data is not appropriate
        _checkDepositDataValidity(_parentHeader,_block, _deposits);
        // check header
        require(_block.header.parentBlock == _parentHeader.hash(), "Invalid prev header");
        uint256 utxoLen = _deposits.length;
        // Append UTXOs from transactions
        for (uint256 i = 0; i < _block.body.txs.length; i++) {
            for(uint256 j = 0; j < _block.body.txs[i].outflow.length; j++) {
                if(_block.body.txs[i].outflow[j].isUTXO()) {
                    utxoLen += 1;
                }
            }
        }
        if (utxoLen != _block.header.utxoIndex - _parentHeader.utxoIndex) {
            return (true, "Invalid UTXO index");
        } else if (_block.header.utxoIndex > MAX_UTXO) {
            return (true, "utxo tree flushed");
        }
    }

    /**
     * @dev Challenge when the submitted block's updated utxo tree root is invalid.
     * @param // block Serialized block data
     * @param // parentHeader Serialized details of its parent header
     * @param _deposits Submit all deposit leaves to be merged.
     * @param _initialSiblings Submit the siblings of the starting index leaf
     */
    function validateUTXORoot(
        bytes calldata, // blockData
        bytes calldata, // parentHeader
        uint256[] calldata _deposits,
        uint256[] calldata _initialSiblings
    )
    external
    view
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        Header memory parentHeader = Deserializer.headerFromCalldataAt(1);
        // This will revert when the submitted header and deposit data is not appropriate
        _checkDepositDataValidity(parentHeader, _block, _deposits);
        uint256[] memory utxos = _getUTXOs(
            _block.header.utxoIndex - parentHeader.utxoIndex,
            _deposits,
            _block.body.txs
        );
        require(_block.header.parentBlock == parentHeader.hash(), "Invalid prev header");
        // Check validity of the roll up using the storage based Poseidon sub-tree roll up
        uint256 computedRoot = SubTreeRollUpLib.rollUpSubTree(
            Hash.poseidon(),
            parentHeader.utxoRoot,
            parentHeader.utxoIndex,
            UTXO_SUB_TREE_DEPTH,
            utxos,
            _initialSiblings
        );
        // Computed new utxo root is different with the submitted
        return (computedRoot != _block.header.utxoRoot, "Invalid UTXO root");
    }

    function _checkDepositDataValidity(
        Header memory parentHeader,
        Block memory _block,
        uint256[] memory deposits
    )
        internal
        pure
    {
        // Check submitted prev header equals to the parent of the submitted block
        require (parentHeader.hash() == _block.header.parentBlock, "invalid prev header");

        // Check submitted deposits are equal to the leaves in the MassDeposits
        uint256 depositIndex = 0;
        for(uint256 i = 0; i < _block.body.massDeposits.length; i++) {
            bytes32 merged = bytes32(0);
            while(merged != _block.body.massDeposits[i].merged) {
                // merge deposits until it matches with the submitted mass deposit's merged leaves.
                merged = keccak256(abi.encodePacked(merged, deposits[depositIndex]));
                depositIndex++;
                if (depositIndex > deposits.length) revert("invalid deposit data");
            }
        }
        require (depositIndex == deposits.length, "invalid deposit data");
    }

    function _getUTXOs(
        uint256 numOfUTXOs,
        uint256[] memory deposits,
        Transaction[] memory txs
    ) private pure returns (uint256[] memory utxos) {
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
        require(numOfUTXOs == index, "Run index challenge");
    }
}
