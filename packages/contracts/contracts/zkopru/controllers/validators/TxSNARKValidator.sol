// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;
pragma experimental ABIEncoderV2;

import { Storage } from "../../storage/Storage.sol";
import { SNARK } from "../../libraries/SNARK.sol";
import { G2Point } from "../../libraries/Pairing.sol";
import {
    Block,
    Transaction,
    Types,
    Proof
} from "../../libraries/Types.sol";
import { Deserializer } from "../../libraries/Deserializer.sol";
import { ITxSNARKValidator } from "../../interfaces/validators/ITxSNARKValidator.sol";

contract TxSNARKValidator is Storage, ITxSNARKValidator {
    using SNARK for SNARK.VerifyingKey;

    uint256 constant SNARK_SCALAR_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 constant PRIME_Q = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

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
        (SNARK.VerifyingKey memory vk, uint256[] memory inputs) = _getParams(transaction);
        // Proof memory proof = transaction.proof;
        if (!_rangeCheck(inputs, transaction.proof)) {
            // Some value is out of range.
            return (true, "S3");
        }
        bool validity = vk.verify(inputs, transaction.proof);
        return (!validity, "S2");
    }

    function _rangeCheck(
        uint256[] memory inputs,
        Proof memory proof
    ) internal pure returns (bool) {
        if (proof.a.X >= PRIME_Q) return false;
        if (proof.a.Y >= PRIME_Q) return false;
        if (proof.b.X[0] >= PRIME_Q) return false;
        if (proof.b.Y[0] >= PRIME_Q) return false;
        if (proof.b.X[1] >= PRIME_Q) return false;
        if (proof.b.Y[1] >= PRIME_Q) return false;
        if (proof.c.X >= PRIME_Q) return false;
        if (proof.c.Y >= PRIME_Q) return false;

        for (uint256 i = 0; i < inputs.length; i++) {
            if (inputs[i] >= SNARK_SCALAR_FIELD) return false;
        }
        return true;
    }

    function _getParams(Transaction memory transaction)
    internal
    view
    returns (SNARK.VerifyingKey memory vk, uint256[] memory inputs) {
        uint256 numOfInflow = transaction.inflow.length;
        uint256 numOfOutflow = transaction.outflow.length;
        require(numOfInflow < 256, 'cannot convert to uint8');
        require(numOfOutflow < 256, 'cannot convert to uint8');
        // Transaction memory transaction = _block.body.txs[txIndex];
        // Slash if the transaction type is not supported
        vk = _getVerifyingKey(
            uint8(numOfInflow),
            uint8(numOfOutflow)
        );
        require(_exist(vk), "S1");
        // Slash if its zk SNARK verification returns false
        inputs = new uint256[](2*numOfInflow + 8*numOfOutflow + 1 + 1);
        uint256 index = 0;
        for (uint256 i = 0; i < numOfInflow; i++) {
            inputs[index++] = uint256(transaction.inflow[i].inclusionRoot);
        }
        for (uint256 i = 0; i < numOfInflow; i++) {
            // inputs[index++] = uint256(transaction.inflow[i].nullifier);
            inputs[index++] = uint256(transaction.inflow[i].nullifier);
        }
        for (uint256 i = 0; i < numOfOutflow; i++) {
            inputs[index++] = uint256(transaction.outflow[i].note);
        }
        for (uint256 i = 0; i < numOfOutflow; i++) {
            inputs[index++] = uint256(transaction.outflow[i].outflowType);
        }
        for (uint256 i = 0; i < numOfOutflow; i++) {
            inputs[index++] = uint256(transaction.outflow[i].publicData.to);
        }
        for (uint256 i = 0; i < numOfOutflow; i++) {
            inputs[index++] = uint256(transaction.outflow[i].publicData.eth);
        }
        for (uint256 i = 0; i < numOfOutflow; i++) {
            inputs[index++] = uint256(transaction.outflow[i].publicData.token);
        }
        for (uint256 i = 0; i < numOfOutflow; i++) {
            inputs[index++] = uint256(transaction.outflow[i].publicData.amount);
        }
        for (uint256 i = 0; i < numOfOutflow; i++) {
            inputs[index++] = uint256(transaction.outflow[i].publicData.nft);
        }
        for (uint256 i = 0; i < numOfOutflow; i++) {
            inputs[index++] = uint256(transaction.outflow[i].publicData.fee);
        }
        inputs[index++] = uint256(transaction.fee);
        inputs[index++] = uint256(transaction.swap);
        require(index == inputs.length, "not enough input data");
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
