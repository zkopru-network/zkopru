// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import { Storage } from "../../storage/Storage.sol";
import { SNARK } from "../../libraries/SNARK.sol";
import { SMT254 } from "../../libraries/SMT.sol";
import {
    Block,
    Header,
    Transaction,
    Outflow,
    PublicData,
    AtomicSwap,
    Proof,
    Types
} from "../../libraries/Types.sol";
import { Deserializer } from "../../libraries/Deserializer.sol";
import { ITxValidator } from "../../interfaces/validators/ITxValidator.sol";

contract TxValidator is Storage, ITxValidator {
    using Types for Header;
    using Types for Outflow;
    using Types for PublicData;
    using SNARK for SNARK.VerifyingKey;

    uint256 constant SNARK_SCALAR_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 constant PRIME_Q = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    /**
     * @dev Challenge when any of the used nullifier's inclusion reference is invalid.
     * @param // blockData Serialized block data
     * @param txIndex Index of the transaction in the tx list of the block body.
     * @param inflowIndex Index of the inflow note in the tx.
     */
    function validateInclusion(
        bytes calldata,
        uint256 txIndex,
        uint256 inflowIndex
    )
    external
    view
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        Transaction memory transaction = _block.body.txs[txIndex];
        uint256 ref = transaction.inflow[inflowIndex].inclusionRoot;
        // code T1: An inflow is referencing an invalid UTXO root.
        return (!isValidRef(_block.header.hash(), ref), "T1");
    }

    /**
     * @notice It checks the validity of an inclusion refernce for a nullifier.
     * @dev Each nullifier should be paired with an inclusion reference which is a root of
     *      utxo tree. For the inclusion reference, You can use finalized roots or recent
     *      blocks' utxo roots. When you use recent blocks' utxo roots, recent REF_DEPTH
     *      of utxo roots are available. It costs maximum 1800*REF_DEPTH gas to validate
     *      an inclusion reference during the TX challenge process.
     * @param l2BlockHash Storage block's hash value where to start searching for.
     * @param ref Utxo root which includes the nullifier's origin utxo.
     */
    function isValidRef(bytes32 l2BlockHash, uint256 ref)
    public
    view
    override
    returns (bool)
    {
        if (Storage.chain.finalizedUTXORoots[ref]) {
            return true;
        }
        bytes32 parentBlock = l2BlockHash;
        for (uint256 i = 0; i < REF_DEPTH; i++) {
            parentBlock = Storage.chain.parentOf[parentBlock];
            if (Storage.chain.utxoRootOf[parentBlock] == ref) {
                return true;
            }
        }
        return false;
    }

    /**
     * @dev Challenge when the submitted transaction has an invalid outflow
     * @param // blockData Serialized block data
     * @param txIndex Index of the transaction in the tx list of the block body.
     */
    function validateOutflow(
        bytes calldata, // blockData
        uint256 txIndex
    )
    external
    view
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        Transaction memory transaction = _block.body.txs[txIndex];
        for(uint256 i = 0; i < transaction.outflow.length; i++) {
            Outflow memory outflow = transaction.outflow[i];
            if (outflow.outflowType > 2) {
                // code T2: An outflow has an invalid type. Only 0, 1, and 2 are allowed.
                return (true, "T2");
            }
            address tokenAddr = outflow.publicData.token;
            if (outflow.outflowType == 0) { // means UTXO
                if (!outflow.publicData.isEmpty()) {
                    // code T3: UTXO type of outflow cannot have public data
                    return (true, "T3");
                }
            } else if (outflow.publicData.token != address(0)) {
                // (ETH + token) withdrawal or migration
                bool isERC20 = Storage.chain.registeredERC20s[tokenAddr];
                bool isERC721 = Storage.chain.registeredERC721s[tokenAddr];
                // means Withdrawal or migration. Inspect revealed token values
                if (!isERC20 && !isERC721) {
                    // code T4: Transaction is including unregistered token
                    return (true, "T4");
                } else if (isERC20) {
                    if (outflow.publicData.nft != 0) {
                        // code T5: This note cannot have NFT field.
                        return (true, "T5");
                    }
                } else if (isERC721) {
                    if (outflow.publicData.amount != 0) {
                        // code T6: This note cannot have ERC20 field.
                        return (true, "T6");
                    } else if (outflow.publicData.nft == 0) {
                        // code T7: ZK SNARK Circuit does not support NFT which id is 0
                        return (true, "T7");
                    }
                }
            } else {
                // ETH withdrawal or migration
                if (outflow.publicData.nft != 0) {
                    return (true, "T5");
                }
                if (outflow.publicData.amount != 0) {
                    return (true, "T6");
                }
            }
        }
    }

    /**
     * @dev Challenge when the submitted transaction does not follow correct atomic swap protocol
     * @param // blockData Serialized block data
     * @param txIndex Index of the transaction in the tx list of the block body.
     */
    function validateAtomicSwap(
        bytes calldata, // blockData
        uint256 txIndex
    )
    external
    pure
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        Transaction memory txA = _block.body.txs[txIndex];
        require(txA.swap != 0, "This tx does not have atomic swap.");
        for(uint256 i = 0; i < _block.body.txs.length; i++) {
            // skip when txA == txB
            if (i == txIndex) continue;
            // Search transaction
            Transaction memory txB = _block.body.txs[i];
            if(
                _includeSwapNote(txB, txA.swap) &&
                _includeSwapNote(txA, txB.swap)
            ) {
                return (false, "");
            }
        }
        // Failed to find the tx pair. Slash.
        return (true, "T8");
    }

    function _includeSwapNote(
        Transaction memory transaction,
        uint256 expectedNote
    )
    pure
    internal
    returns (bool)
    {
        if (transaction.swap == 0) return false;
        for (uint256 i = 0; i < transaction.outflow.length; i++) {
            if (transaction.outflow[i].note == expectedNote) return true;
        }
        return false;
    }

    /**
     * @dev Challenge when the block is trying to use an already used nullifier.
     * @param // blockData Serialized block data
     * @param // parentHeader  Serialized parent header data
     * @param txIndex Index of the transaction in the tx list of the block body.
     * @param inflowIndex Index of the inflow note in the tx.
     * @param sibling The sibling data of the nullifier.
     */
    function validateUsedNullifier(
        bytes calldata, // blockData
        bytes calldata, // parentHeader
        uint256 txIndex,
        uint256 inflowIndex,
        bytes32[254] calldata sibling
    )
    external
    pure
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        Header memory _parentHeader = Deserializer.headerFromCalldataAt(1);
        bytes32 usedNullifier = _block.body.txs[txIndex].inflow[inflowIndex].nullifier;
        bytes32[] memory nullifiers = new bytes32[](1);
        bytes32[254][] memory siblings = new bytes32[254][](1);
        nullifiers[0] = usedNullifier;
        siblings[0] = sibling;
        bytes32 updatedRoot = SMT254.fill(
            _parentHeader.nullifierRoot,
            nullifiers,
            siblings
        );
        // should be updated if the nullifier wasn't used before.
        // code T9: Transaction is using an already spent nullifier.
        return (updatedRoot == _parentHeader.nullifierRoot,  "T9");
    }

    /**
     * @dev Challenge when a nullifier used twice in a same block.
     * @param // blockData Serialized block data
     * @param nullifier Double included nullifier.
     */
    function validateDuplicatedNullifier(
        bytes calldata, // blockData
        bytes32 nullifier
    )
    external
    pure
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        uint256 count = 0;
        for (uint256 i = 0; i < _block.body.txs.length; i++) {
            Transaction memory transaction = _block.body.txs[i];
            for (uint256 j = 0; j < transaction.inflow.length; j++) {
                // Found matched nullifier
                if (transaction.inflow[j].nullifier == nullifier) count++;
                if (count >= 2) break;
            }
            if (count >= 2) break;
        }
        // code T10: Some transactions in the block are trying to use a same nullifier.
        return (count >= 2, "T10");
    }

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
