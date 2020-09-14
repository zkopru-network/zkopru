pragma solidity = 0.6.12;

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
     * @dev Challenge when any of the used nullifier's inclusion reference is invalid.
     * @param txIndex Index of the transaction in the tx list of the block body.
     * @param inflowIndex Index of the inflow note in the tx.
     * @param blockData Serialized block data
     */
    function challengeInclusion(
        uint256 txIndex,
        uint256 inflowIndex,
        bytes calldata blockData
    ) external {
        bytes32 proposalId = keccak256(blockData);
        Block memory _block = Deserializer.blockFromCalldataAt(2);
        Challenge memory result = _challengeResultOfInclusion(
            _block,
            txIndex,
            inflowIndex
        );
        _execute(proposalId, result);
    }

    /**
     * @dev Challenge when any submitted transaction has an invalid SNARK proof
     * @param txIndex Index of the transaction in the tx list of the block body.
     * @param blockData Serialized block data
     */
    function challengeTransaction(uint256 txIndex, bytes calldata blockData) external {
        bytes32 proposalId = keccak256(blockData);
        Block memory _block = Deserializer.blockFromCalldataAt(1);
        Challenge memory result = _challengeResultOfTransaction(_block, txIndex);
        _execute(proposalId, result);
    }

    /**
     * @dev Challenge when the submitted transaction does not follow correct atomic swap protocol
     * @param txIndex Index of the transaction in the tx list of the block body.
     * @param blockData Serialized block data
     */
    function challengeAtomicSwap(uint256 txIndex, bytes calldata blockData) external {
        bytes32 proposalId = keccak256(blockData);
        Block memory _block = Deserializer.blockFromCalldataAt(1);
        Challenge memory result = _challengeAtomicSwap(_block, txIndex);
        _execute(proposalId, result);
    }

    /**
     * @dev Challenge when the block is trying to use an already used nullifier.
     * @param txIndex Index of the transaction in the tx list of the block body.
     * @param inflowIndex Index of the inflow note in the tx.
     * @param sibling The sibling data of the nullifier.
     * @param // parentHeader Serialized parent header data
     * @param blockData Serialized block data
     */
    function challengeUsedNullifier(
        uint256 txIndex,
        uint256 inflowIndex,
        bytes32[254] calldata sibling,
        bytes calldata /**parentHeader*/,
        bytes calldata blockData
    ) external {
        bytes32 proposalId = keccak256(blockData);
        Header memory _parentHeader = Deserializer.headerFromCalldataAt(3);
        Block memory _block = Deserializer.blockFromCalldataAt(4);
        Challenge memory result = _challengeResultOfUsedNullifier(
            _block,
            _parentHeader,
            txIndex,
            inflowIndex,
            sibling
        );
        _execute(proposalId, result);
    }

    /**
     * @dev Challenge when a nullifier used twice in a same block.
     * @param nullifier Double included nullifier.
     * @param blockData Serialized block data
     */
    function challengeDuplicatedNullifier(bytes32 nullifier, bytes calldata blockData) external {
        bytes32 proposalId = keccak256(blockData);
        Block memory _block = Deserializer.blockFromCalldataAt(1);
        Challenge memory result = _challengeResultOfDuplicatedNullifier(_block, nullifier);
        _execute(proposalId, result);
    }

    /**
     * @notice It checks the validity of an inclusion refernce for a nullifier.
     * @dev Each nullifier should be paired with an inclusion reference which is a root of
     *      utxo tree. For the inclusion reference, You can use finalized roots or recent
     *      blocks' utxo roots. When you use recent blocks' utxo roots, recent REF_DEPTH
     *      of utxo roots are available. It costs maximum 1800*REF_DEPTH gas to validate
     *      an inclusion reference during the TX challenge process.
     * @param l2BlockHash Layer2 block's hash value where to start searching for.
     * @param ref Utxo root which includes the nullifier's origin utxo.
     */
    function isValidRef(bytes32 l2BlockHash, uint256 ref) public view returns (bool) {
        if (Layer2.chain.finalizedUTXORoots[ref]) {
            return true;
        }
        bytes32 parentBlock = l2BlockHash;
        for (uint256 i = 0; i < REF_DEPTH; i++) {
            parentBlock = Layer2.chain.parentOf[parentBlock];
            if (Layer2.chain.utxoRootOf[parentBlock] == ref) {
                return true;
            }
        }
        return false;
    }

    function _challengeResultOfInclusion(
        Block memory _block,
        uint256 txIndex,
        uint256 inflowIndex
    )
        internal
        view
        returns (Challenge memory)
    {
        Transaction memory transaction = _block.body.txs[txIndex];
        uint256 ref = transaction.inflow[inflowIndex].inclusionRoot;
        return Challenge(
            !isValidRef(_block.header.hash(), ref),
            _block.header.proposer,
            "Inclusion reference validation"
        );
    }

    function _challengeResultOfTransaction(
        Block memory _block,
        uint256 txIndex
    )
        internal
        view
        returns (Challenge memory)
    {
        Transaction memory transaction = _block.body.txs[txIndex];

        for(uint256 i = 0; i < transaction.outflow.length; i++) {
            Outflow memory outflow = transaction.outflow[i];
            if (outflow.outflowType > 2) {
                return Challenge(
                    true,
                    _block.header.proposer,
                    "Outflow type should be one of 0: UTXO, 1: Withdrawal, 2: Migration"
                );
            }
            if(outflow.isUTXO()) { // means UTXO
                if(!outflow.publicData.isEmpty()) {
                    return Challenge(
                        true,
                        _block.header.proposer,
                        "Outflow should not reveal details"
                    );
                }
            } else {
                if(outflow.publicData.amount * outflow.publicData.nft != 0) {
                    return Challenge(
                        true,
                        _block.header.proposer,
                        "ERC20 and NFT cannot both exist"
                    );
                }
            }
        }
        // Slash if the transaction type is not supported
        SNARK.VerifyingKey memory vk = _getVerifyingKey(
            uint8(transaction.inflow.length),
            uint8(transaction.outflow.length)
        );
        if (!_exist(vk)) {
            return Challenge(
                true,
                _block.header.proposer,
                "Unsupported tx type"
            );
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
        if (!vk.verifySnarkProof(inputs, transaction.proof)) {
            return Challenge(
                true,
                _block.header.proposer,
                "SNARK failed"
            );
        }
        // Passed all tests. It's a valid transaction. Challenge is not accepted
        return Challenge(
            false,
            _block.header.proposer,
            "Valid transaction"
        );
    }

    function _challengeAtomicSwap(
        Block memory _block,
        uint256 txIndex
    )
        internal
        pure
        returns (Challenge memory)
    {
        uint256 swap = _block.body.txs[txIndex].swap;
        uint256 counterpart;
        for(uint256 i = 0; i < _block.body.txs.length; i++) {
            if(
                swap == _block.body.txs[i].swap &&
                i != txIndex
             ) {
                counterpart++;
             }
        }
        return Challenge(
            counterpart != 1,
            _block.header.proposer,
            "Only 1 counterpart tx should exist"
        );
    }

    function _challengeResultOfUsedNullifier(
        Block memory _block,
        Header memory _parentHeader,
        uint256 txIndex,
        uint256 inflowIndex,
        bytes32[254] memory sibling
    )
        internal
        pure
        returns (Challenge memory)
    {
        bytes32 usedNullifier = _block.body.txs[txIndex].inflow[inflowIndex].nullifier;
        bytes32[] memory nullifiers = new bytes32[](1);
        bytes32[254][] memory siblings = new bytes32[254][](1);
        nullifiers[0] = usedNullifier;
        siblings[0] = sibling;
        bytes32 updatedRoot = SMT254.rollUp(
            _parentHeader.nullifierRoot,
            nullifiers,
            siblings
        );
        return Challenge(
            updatedRoot == _parentHeader.nullifierRoot,
            _block.header.proposer,
            "Double spending validation"
        );
    }

    function _challengeResultOfDuplicatedNullifier(
        Block memory _block,
        bytes32 nullifier
    )
        internal
        pure
        returns (Challenge memory)
    {
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
        return Challenge(
            count >= 2,
            _block.header.proposer,
            "Duplicated nullifier"
        );
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
