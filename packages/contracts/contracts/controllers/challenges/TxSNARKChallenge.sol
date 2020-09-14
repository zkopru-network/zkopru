// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;
pragma experimental ABIEncoderV2;

import { Layer2 } from "../../storage/Layer2.sol";
import { Challengeable } from "../Challengeable.sol";
import { SNARK } from "../../libraries/SNARK.sol";
import { SMT254 } from "../../libraries/SMT.sol";
import {
    Block,
    Header,
    Challenge,
    Transaction,
    Outflow,
    PublicData,
    AtomicSwap,
    Types
} from "../../libraries/Types.sol";
import { Deserializer } from "../../libraries/Deserializer.sol";

contract TxChallenge is Challengeable {
    using Types for Header;
    using Types for Outflow;
    using Types for PublicData;
    using SMT254 for SMT254.OPRU;
    using SNARK for SNARK.VerifyingKey;

    /**
     * @dev Challenge when the submitted transaction has an invalid SNARK proof
     * @param txIndex Index of the transaction in the tx list of the block body.
     * @param blockData Serialized block data
     */
    function challengeSNARK(uint256 txIndex, bytes calldata blockData) external {
        bytes32 proposalId = keccak256(blockData);
        Block memory _block = Deserializer.blockFromCalldataAt(1);
        Challenge memory result = _challengeResultOfSNARK(_block, txIndex);
        _execute(proposalId, result);
    }

    function hasValidSNARK(Transaction memory transaction)
        external
        view
        returns (bool result, string memory reason)
    {
        // Transaction memory transaction = _block.body.txs[txIndex];
        // Slash if the transaction type is not supported
        SNARK.VerifyingKey memory vk = _getVerifyingKey(
            uint8(transaction.inflow.length),
            uint8(transaction.outflow.length)
        );
        if (!_exist(vk)) {
            return (true, "Unsupported tx type");
        }
        // Slash if its zk SNARK verification returns false
        uint256[] memory inputs = new uint256[](1 + 1 + 2*transaction.inflow.length + 8*transaction.outflow.length);
        uint256 index = 0;
        inputs[index++] = uint256(transaction.fee);
        inputs[index++] = transaction.swap;
        for (uint256 i = 0; i < transaction.inflow.length; i++) {
            inputs[index++] = uint256(transaction.inflow[i].inclusionRoot);
            inputs[index++] = uint256(transaction.inflow[i].nullifier);
        }
        for (uint256 i = 0; i < transaction.outflow.length; i++) {
            inputs[index++] = uint256(transaction.outflow[i].note);
            // These only exist for migration
            inputs[index++] = uint256(transaction.outflow[i].publicData.to);
            inputs[index++] = uint256(transaction.outflow[i].publicData.eth);
            inputs[index++] = uint256(transaction.outflow[i].publicData.token);
            inputs[index++] = uint256(transaction.outflow[i].publicData.amount);
            inputs[index++] = uint256(transaction.outflow[i].publicData.nft);
            inputs[index++] = uint256(transaction.outflow[i].publicData.fee);
        }
        result = vk.verifySnarkProof(inputs, transaction.proof);
        if (result) {
            reason = "Valid SNARK.";
        } else {
            reason = "Invalid SNARK.";
        }
    }
    
    function _challengeResultOfSNARK(
        Block memory _block,
        uint256 txIndex
    )
        internal
        view
        returns (Challenge memory)
    {
        Transaction memory transaction = _block.body.txs[txIndex];
        try this.hasValidSNARK(transaction) returns (bool validity, string memory reason) {
            return Challenge(
                !validity,
                _block.header.proposer,
                reason
            );
        } catch Error(string memory reason) {
            return Challenge(
                true,
                _block.header.proposer,
                reason
            );
        } catch (bytes memory reason) {
            return Challenge(
                true,
                _block.header.proposer,
                string(reason)
            );
        }
    }
    
    /** Internal functions to help reusable clean code */
    function _getVerifyingKey(
        uint8 numberOfInputs,
        uint8 numberOfOutputs
    ) internal view returns (SNARK.VerifyingKey memory) {
        return vks[Types.getSNARKSignature(numberOfInputs, numberOfOutputs)];
    }

    function _exist(SNARK.VerifyingKey memory vk) internal pure returns (bool) {
        if (vk.alfa1.X != 0) {
            return true;
        } else {
            return false;
        }
    }
}
