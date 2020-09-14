// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import { Layer2 } from "../../storage/Layer2.sol";
import { Challengeable } from "../Challengeable.sol";
import { SMT254 } from "../../libraries/SMT.sol";
import { Hash } from "../../libraries/Hash.sol";
import {
    Block,
    Challenge,
    Transaction,
    Outflow,
    OutflowType,
    Header,
    Types
} from "../../libraries/Types.sol";
import { Deserializer } from "../../libraries/Deserializer.sol";

contract NullifierTreeChallenge is Challengeable {
    using Types for Header;

    /**
     * @dev Challenge when the submitted block's nullifier tree transition is invalid.
     * @param numOfNullifiers Number of used nullifiers to help the computation.
     * @param siblings Siblings of each nullifier.
     * @param // parentHeader  Serialized parent header data
     * @param blockData Serialized block data
     */
    function challengeNullifierRollUp(
        uint256 numOfNullifiers,
        bytes32[254][] calldata siblings,
        bytes calldata /** parentHeader */,
        bytes calldata blockData
    ) external {
        bytes32 proposalId = keccak256(blockData);
        Header memory parentHeader = Deserializer.headerFromCalldataAt(2);
        Block memory l2Block = Deserializer.blockFromCalldataAt(3);
        require(l2Block.header.parentBlock == parentHeader.hash(), "Invalid prev header");
        Challenge memory result = _challengeResultOfNullifierRollUp(
            l2Block,
            parentHeader,
            numOfNullifiers,
            siblings
        );
        _execute(proposalId, result);
    }

    /** Computes challenge here */

    function _challengeResultOfNullifierRollUp(
        Block memory l2Block,
        Header memory parentHeader,
        uint256 numOfNullifiers,
        bytes32[254][] memory siblings
    )
        internal
        pure
        returns (Challenge memory)
    {
        require(l2Block.header.parentBlock == parentHeader.hash(), "Invalid prev header");
        // Assign a new array
        bytes32[] memory nullifiers = new bytes32[](numOfNullifiers);
        // Get outputs to append
        uint256 index = 0;
        for (uint256 i = 0; i < l2Block.body.txs.length; i++) {
            Transaction memory transaction = l2Block.body.txs[i];
            for (uint256 j = 0; j < transaction.inflow.length; j++) {
                nullifiers[index++] = transaction.inflow[j].nullifier;
            }
        }
        require(index == numOfNullifiers, "Invalid numOfNullifier");

        // Get rolled up root
        bytes32 computedRoot = SMT254.rollUp(
            parentHeader.nullifierRoot,
            nullifiers,
            siblings
        );
        // Computed new nullifier root is different with the submitted
        return Challenge(
            l2Block.header.nullifierRoot != computedRoot,
            l2Block.header.proposer,
            "Nullifier root"
        );
    }
}
