// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;
pragma experimental ABIEncoderV2;

import { Layer2 } from "../../storage/Layer2.sol";
import { SNARK } from "../../libraries/SNARK.sol";
import {
    Block,
    Transaction,
    Types
} from "../../libraries/Types.sol";
import { Deserializer } from "../../libraries/Deserializer.sol";
import { ITxSNARKValidator } from "../../interfaces/validators/ITxSNARKValidator.sol";

contract TxSNARKValidator is Layer2, ITxSNARKValidator {
    using SNARK for SNARK.VerifyingKey;

    /**
     * @dev Challenge when the submitted transaction has an invalid SNARK proof
     * @param // blockData Serialized block data
     * @param txIndex Index of the transaction in the tx list of the block body.
     */
    function validateSNARK(
        bytes calldata, //blockData
        uint256 txIndex
    )
    external
    view
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        Transaction memory transaction = _block.body.txs[txIndex];
        try this.hasValidSNARK(transaction) returns (bool validity, string memory _reason) {
            return (!validity, _reason);
        } catch Error(string memory _reason) {
            return (true, _reason);
        } catch (bytes memory _reason) {
            return (true, string(_reason));
        }
    }

    function hasValidSNARK(Transaction memory transaction)
     external
     view
     override
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
    
    /** Internal functions to help reusable clean code */
    function _getVerifyingKey(
        uint8 numberOfInputs,
        uint8 numberOfOutputs
    ) internal view returns (SNARK.VerifyingKey memory) {
        return vks[Types.getSNARKSignature(numberOfInputs, numberOfOutputs)];
    }

    function _exist(SNARK.VerifyingKey memory vk) internal pure returns (bool) {
        if (vk.alpha1.X != 0) {
            return true;
        } else {
            return false;
        }
    }
}
