pragma solidity >= 0.6.0;

import { Layer2 } from "../../storage/Layer2.sol";
import { Challengeable } from "../Challengeable.sol";
import { SNARKsVerifier } from "../../libraries/SNARKs.sol";
import { SMT256 } from "smt-rollup/contracts/SMT.sol";
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
    using SMT256 for SMT256.OPRU;
    using SNARKsVerifier for SNARKsVerifier.VerifyingKey;

    function challengeInclusion(
        uint txIndex,
        uint inflowIndex,
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

    function challengeTransaction(uint index, bytes calldata blockData) external {
        bytes32 proposalId = keccak256(blockData);
        Block memory _block = Deserializer.blockFromCalldataAt(1);
        Challenge memory result = _challengeResultOfTransaction(_block, index);
        _execute(proposalId, result);
    }

    function challengeAtomicSwap(uint index, bytes calldata blockData) external {
        bytes32 proposalId = keccak256(blockData);
        Block memory _block = Deserializer.blockFromCalldataAt(1);
        Challenge memory result = _challengeAtomicSwap(_block, index);
        _execute(proposalId, result);
    }

    function challengeUsedNullifier(
        uint txIndex,
        uint inflowIndex,
        bytes32[256] calldata sibling,
        bytes calldata,
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

    function challengeDuplicatedNullifier(bytes32 nullifier, bytes calldata blockData) external {
        bytes32 proposalId = keccak256(blockData);
        Block memory _block = Deserializer.blockFromCalldataAt(1);
        Challenge memory result = _challengeResultOfDuplicatedNullifier(_block, nullifier);
        _execute(proposalId, result);
    }

    function isValidRef(bytes32 l2BlockHash, uint256 ref) public view returns (bool) {
        if (Layer2.chain.finalizedUTXOs[ref]) {
            return true;
        }
        bytes32 parentBlock = l2BlockHash;
        for (uint i = 0; i < REF_DEPTH; i++) {
            parentBlock = Layer2.chain.parentOf[parentBlock];
            if (Layer2.chain.utxoRootOf[parentBlock] == ref) {
                return true;
            }
        }
        return false;
    }

    function _challengeResultOfInclusion(
        Block memory _block,
        uint txIndex,
        uint inflowIndex
    )
        internal
        view
        returns (Challenge memory)
    {
        Transaction memory transaction = _block.body.txs[txIndex];
        uint ref = transaction.inflow[inflowIndex].inclusionRoot;
        return Challenge(
            !isValidRef(_block.header.hash(), ref),
            _block.header.proposer,
            "Inclusion reference validation"
        );
    }

    function _challengeResultOfTransaction(
        Block memory _block,
        uint txIndex
    )
        internal
        view
        returns (Challenge memory)
    {
        Transaction memory transaction = _block.body.txs[txIndex];

        for(uint i = 0; i < transaction.outflow.length; i++) {
            Outflow memory outflow = transaction.outflow[i];
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
        /// Slash if the transaction type is not supported
        SNARKsVerifier.VerifyingKey memory vk = _getVerifyingKey(
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
        /// Slash if its zk SNARKs verification returns false
        uint[] memory inputs = new uint[](1 + 1 + 2*transaction.inflow.length + 8*transaction.outflow.length);
        uint index = 0;
        inputs[index++] = uint(transaction.fee);
        inputs[index++] = transaction.swap;
        for (uint i = 0; i < transaction.inflow.length; i++) {
            inputs[index++] = uint(transaction.inflow[i].inclusionRoot);
            inputs[index++] = uint(transaction.inflow[i].nullifier);
        }
        for (uint i = 0; i < transaction.outflow.length; i++) {
            inputs[index++] = uint(transaction.outflow[i].note);
            /// These only exist for migration
            inputs[index++] = uint(transaction.outflow[i].publicData.to);
            inputs[index++] = uint(transaction.outflow[i].publicData.eth);
            inputs[index++] = uint(transaction.outflow[i].publicData.token);
            inputs[index++] = uint(transaction.outflow[i].publicData.amount);
            inputs[index++] = uint(transaction.outflow[i].publicData.nft);
            inputs[index++] = uint(transaction.outflow[i].publicData.fee);
        }
        if (!vk.zkSNARKs(inputs, transaction.proof)) {
            return Challenge(
                true,
                _block.header.proposer,
                "SNARKs failed"
            );
        }
        /// Passed all tests. It's a valid transaction. Challenge is not accepted
        return Challenge(
            false,
            _block.header.proposer,
            "Valid transaction"
        );
    }

    function _challengeAtomicSwap(
        Block memory _block,
        uint txIndex
    )
        internal
        pure
        returns (Challenge memory)
    {
        uint swap = _block.body.txs[txIndex].swap;
        uint counterpart;
        for(uint i = 0; i < _block.body.txs.length; i++) {
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
        uint txIndex,
        uint inflowIndex,
        bytes32[256] memory sibling
    )
        internal
        pure
        returns (Challenge memory)
    {
        bytes32 usedNullifier = _block.body.txs[txIndex].inflow[inflowIndex].nullifier;
        bytes32[] memory nullifiers = new bytes32[](1);
        bytes32[256][] memory siblings = new bytes32[256][](1);
        nullifiers[0] = usedNullifier;
        siblings[0] = sibling;
        bytes32 updatedRoot = SMT256.rollUp(
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
        uint count = 0;
        for (uint i = 0; i < _block.body.txs.length; i++) {
            Transaction memory transaction = _block.body.txs[i];
            for (uint j = 0; j < transaction.inflow.length; j++) {
                /// Found matched nullifier
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
    ) internal view returns (SNARKsVerifier.VerifyingKey memory) {
        return vks[Types.getSNARKsSignature(numberOfInputs, numberOfOutputs)];
    }

    function _exist(SNARKsVerifier.VerifyingKey memory vk) internal pure returns (bool) {
        if (vk.alfa1.X != 0) {
            return true;
        } else {
            return false;
        }
    }
}
