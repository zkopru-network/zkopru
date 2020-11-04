// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import { Storage } from "../../storage/Storage.sol";
import { SMT254 } from "../../libraries/SMT.sol";
import { Hash } from "../../libraries/Hash.sol";
import {
    Block,
    Transaction,
    Outflow,
    OutflowType,
    Header,
    Types
} from "../../libraries/Types.sol";
import { Deserializer } from "../../libraries/Deserializer.sol";
import { INullifierTreeValidator } from "../../interfaces/validators/INullifierTreeValidator.sol";

contract NullifierTreeValidator is Storage, INullifierTreeValidator {
    using Types for Header;

    /**
     * @dev Challenge when the submitted block's nullifier tree transition is invalid.
     * @param // blockData Serialized block data
     * @param // parentHeader  Serialized parent header data
     * @param numOfNullifiers Number of used nullifiers to help the computation.
     * @param siblings Siblings of each nullifier.
     */
    function validateNullifierRollUp(
        bytes calldata,
        bytes calldata,
        uint256 numOfNullifiers,
        bytes32[254][] calldata siblings
    )
    external
    pure
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        Header memory _parentHeader = Deserializer.headerFromCalldataAt(1);
        require(_block.header.parentBlock == _parentHeader.hash(), "Invalid prev header");
        // Assign a new array
        bytes32[] memory nullifiers = new bytes32[](numOfNullifiers);
        // Get outputs to append
        uint256 index = 0;
        for (uint256 i = 0; i < _block.body.txs.length; i++) {
            Transaction memory transaction = _block.body.txs[i];
            for (uint256 j = 0; j < transaction.inflow.length; j++) {
                nullifiers[index++] = transaction.inflow[j].nullifier;
            }
        }
        require(index == numOfNullifiers, "Invalid numOfNullifier");

        // Get rolled up root
        bytes32 computedRoot = SMT254.fill(
            _parentHeader.nullifierRoot,
            nullifiers,
            siblings
        );
        // Computed new nullifier root is different with the submitted
        // code N1: Nullifier root is different
        return (_block.header.nullifierRoot != computedRoot, "N1");
    }
}
