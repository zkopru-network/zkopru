// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import { Layer2 } from "../../storage/Layer2.sol";
import { Challengeable } from "../Challengeable.sol";
import { SubTreeRollUpLib } from "../../libraries/Tree.sol";
import { Hash } from "../../libraries/Hash.sol";
import {
    Block,
    Challenge,
    Transaction,
    Outflow,
    MassDeposit,
    OutflowType,
    Header,
    Types
} from "../../libraries/Types.sol";
import { Deserializer } from "../../libraries/Deserializer.sol";

contract UtxoTreeChallenge is Challengeable {
    using Types for Outflow;
    using Types for Header;

    /**
     * @dev Challenge when the submitted block's updated utxo tree index is invalid.
     * @param deposits Submit all deposit leaves to be merged.
     * @param // parentHeader  Serialized parent header data
     * @param blockData Serialized block data
     */
    function challengeUTXOIndex(
        uint256[] calldata deposits,
        bytes calldata /** parentHeader */,
        bytes calldata blockData
    ) external {
        bytes32 proposalId = keccak256(blockData);
        Header memory parentHeader = Deserializer.headerFromCalldataAt(1);
        Block memory l2Block = Deserializer.blockFromCalldataAt(2);
        // This will revert when the submitted header and deposit data is not appropriate
        _checkDepositDataValidity(parentHeader, l2Block, deposits);
        Challenge memory result = _challengeResultOfUTXOIndex(
            l2Block,
            parentHeader,
            deposits.length
        );
        _execute(proposalId, result);
    }

    /**
     * @dev Challenge when the submitted block's updated utxo tree root is invalid.
     * @param deposits Submit all deposit leaves to be merged.
     * @param initialSiblings Submit the siblings of the starting index leaf
     * @param // parentHeader  Serialized parent header data
     * @param blockData Serialized block data
     */
    function challengeUTXORoot(
        uint256[] calldata deposits,
        uint256[] calldata initialSiblings,
        bytes calldata /**parentHeader*/,
        bytes calldata blockData // serialized block data
    ) external {
        bytes32 proposalId = keccak256(blockData);
        Header memory parentHeader = Deserializer.headerFromCalldataAt(2);
        Block memory l2Block = Deserializer.blockFromCalldataAt(3);
        // This will revert when the submitted header and deposit data is not appropriate
        _checkDepositDataValidity(parentHeader, l2Block, deposits);
        uint256[] memory utxos = _getUTXOs(
            l2Block.header.utxoIndex - parentHeader.utxoIndex,
            deposits,
            l2Block.body.txs
        );
        Challenge memory result = _challengeResultOfUTXORoot(
            l2Block,
            parentHeader,
            utxos,
            initialSiblings
        );
        _execute(proposalId, result);
    }

    /** Computes challenge here */

    function _checkDepositDataValidity(
        Header memory parentHeader,
        Block memory l2Block,
        uint256[] memory deposits
    )
        internal
        pure
    {
        // Check submitted prev header equals to the parent of the submitted block
        require (parentHeader.hash() == l2Block.header.parentBlock, "invalid prev header");

        // Check submitted deposits are equal to the leaves in the MassDeposits
        uint256 depositIndex = 0;
        for(uint256 i = 0; i < l2Block.body.massDeposits.length; i++) {
            bytes32 merged = bytes32(0);
            while(merged != l2Block.body.massDeposits[i].merged) {
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

    function _challengeResultOfUTXOIndex(
        Block memory l2Block,
        Header memory parentHeader,
        uint256 depositLen
    )
        internal
        pure
        returns (Challenge memory)
    {
        require(l2Block.header.parentBlock == parentHeader.hash(), "Invalid prev header");
        uint256 utxoLen = depositLen;
        // Append UTXOs from transactions
        for (uint256 i = 0; i < l2Block.body.txs.length; i++) {
            for(uint256 j = 0; j < l2Block.body.txs[i].outflow.length; j++) {
                if(l2Block.body.txs[i].outflow[j].isUTXO()) {
                    utxoLen += 1;
                }
            }
        }
        if (utxoLen != l2Block.header.utxoIndex - parentHeader.utxoIndex) {
            return Challenge(
                true,
                l2Block.header.proposer,
                "Invalid UTXO index"
            );
        } else if (l2Block.header.utxoIndex > MAX_UTXO) {
            return Challenge(
                true,
                l2Block.header.proposer,
                "utxo tree flushed"
            );
        }
    }

    function _challengeResultOfUTXORoot(
        Block memory l2Block,
        Header memory parentHeader,
        uint256[] memory utxos,
        uint256[] memory initialSiblings
    )
        internal
        pure
        returns (Challenge memory)
    {
        require(l2Block.header.parentBlock == parentHeader.hash(), "Invalid prev header");
        // Check validity of the roll up using the storage based Poseidon sub-tree roll up
        uint256 computedRoot = SubTreeRollUpLib.rollUpSubTree(
            Hash.poseidon(),
            parentHeader.utxoRoot,
            parentHeader.utxoIndex,
            UTXO_SUB_TREE_DEPTH,
            utxos,
            initialSiblings
        );
        // Computed new utxo root is different with the submitted
        return Challenge(
            computedRoot != l2Block.header.utxoRoot,
            l2Block.header.proposer,
            "Invalid UTXO root"
        );
    }
}
