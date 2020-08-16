pragma solidity >= 0.6.0;

import { Layer2 } from "../../storage/Layer2.sol";
import { Challengeable } from "../Challengeable.sol";
import { SplitRollUp } from "../../libraries/Tree.sol";
import { SubTreeRollUpLib } from "../../libraries/Tree.sol";
import { RollUpLib } from "../../libraries/Tree.sol";
import { SMT254 } from "../../libraries//SMT.sol";
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

contract RollUpChallenge is Challengeable {
    using SubTreeRollUpLib for SplitRollUp;
    using SMT254 for SMT254.OPRU;
    using Types for Outflow;
    using Types for Header;

    function challengeUTXORollUp(
        uint utxoRollUpId,
        uint[] calldata _deposits,
        uint numOfUTXOs,
        bytes calldata,
        bytes calldata blockData
    ) external {
        bytes32 proposalId = keccak256(blockData);
        Header memory _parentHeader = Deserializer.headerFromCalldataAt(3);
        Block memory _block = Deserializer.blockFromCalldataAt(4);
        Challenge memory result = _challengeResultOfUTXORollUp(
            _block,
            _parentHeader,
            utxoRollUpId,
            numOfUTXOs,
            _deposits
        );
        _execute(proposalId, result);
    }

    function challengeNullifierRollUp(
        uint nullifierRollUpId,
        uint numOfNullifiers,
        bytes calldata,
        bytes calldata blockData
    ) external {
        bytes32 proposalId = keccak256(blockData);
        Header memory _parentHeader = Deserializer.headerFromCalldataAt(2);
        Block memory _block = Deserializer.blockFromCalldataAt(3);
        Challenge memory result = _challengeResultOfNullifierRollUp(
            _block,
            _parentHeader,
            nullifierRollUpId,
            numOfNullifiers
        );
        _execute(proposalId, result);
    }

    function challengeWithdrawalRollUp(
        uint withdrawalRollUpId,
        uint numOfWithdrawals,
        bytes calldata,
        bytes calldata blockData
    ) external {
        bytes32 proposalId = keccak256(blockData);
        Header memory _parentHeader = Deserializer.headerFromCalldataAt(2);
        Block memory _block = Deserializer.blockFromCalldataAt(3);
        Challenge memory result = _challengeResultOfWithdrawalRollUp(
            _block,
            _parentHeader,
            withdrawalRollUpId,
            numOfWithdrawals
        );
        _execute(proposalId, result);
    }

    /** Computes challenge here */
    function _challengeResultOfUTXORollUp(
        Block memory _block,
        Header memory _parentHeader,
        uint _utxoRollUpId,
        uint _utxoNum,
        uint[] memory _deposits
    )
        internal
        view
        returns (Challenge memory)
    {
        /// Check submitted _deposits are equal to the leaves in the MassDeposits
        uint depositIndex = 0;
        for(uint i = 0; i < _block.body.massDeposits.length; i++) {
            MassDeposit memory massDeposit = _block.body.massDeposits[i];
            bytes32 merged = bytes32(0);
            bytes32 target = massDeposit.merged;
            while(merged != target) {
                /// merge _deposits until it matches with the submitted mass deposit's merged leaves.
                merged = keccak256(abi.encodePacked(merged, _deposits[depositIndex]));
                depositIndex++;
            }
        }
        require(depositIndex == _deposits.length, "Submitted _deposits are different with the MassDeposits");

        /// Assign a new array
        uint[] memory outputs = new uint[](_utxoNum);
        uint index = 0;
        /// Append _deposits first
        for (uint i = 0; i < _deposits.length; i++) {
            outputs[index++] = _deposits[i];
        }
        /// Append UTXOs from transactions
        for (uint i = 0; i < _block.body.txs.length; i++) {
            Transaction memory transaction = _block.body.txs[i];
            for(uint j = 0; j < transaction.outflow.length; j++) {
                if(transaction.outflow[j].isUTXO()) {
                    outputs[index++] = transaction.outflow[j].note;
                }
            }
        }
        require(_utxoNum == index, "Submitted invalid num of utxo num");

        /// UTXO tree flushed
        if (_parentHeader.utxoIndex + _utxoNum > MAX_UTXO) {
            return Challenge(
                true,
                _block.header.proposer,
                "utxo tree flushed"
            );
        }
        /// Submitted invalid next output index
        if (_block.header.utxoIndex != (_parentHeader.utxoIndex + _utxoNum)) {
            return Challenge(
                true,
                _block.header.proposer,
                "Invalid utxo index"
            );
        }

        /// Check validity of the roll up using the storage based Poseidon sub-tree roll up
        // SplitRollUp memory rollUpProof =
        bool isValidRollUp = Layer2.proof.ofUTXORollUp[_utxoRollUpId].verify(
            SubTreeRollUpLib.newSubTreeOPRU(
                uint(_parentHeader.utxoRoot),
                _parentHeader.utxoIndex,
                uint(_block.header.utxoRoot),
                UTXO_SUB_TREE_DEPTH,
                outputs
            )
        );
        return Challenge(
            !isValidRollUp,
            _block.header.proposer,
            "UTXO roll up"
        );
    }

    /// Possibility to cost a lot of failure gases because of the 'already slashed' _blocks
    function _challengeResultOfNullifierRollUp(
        Block memory _block,
        Header memory _parentHeader,
        uint nullifierRollUpId,
        uint numOfNullifiers
    )
        internal
        view
        returns (Challenge memory)
    {
        require(_block.header.parentBlock == _parentHeader.hash(), "Invalid prev header");
        /// Assign a new array
        bytes32[] memory nullifiers = new bytes32[](numOfNullifiers);
        /// Get outputs to append
        uint index = 0;
        for (uint i = 0; i < _block.body.txs.length; i++) {
            Transaction memory transaction = _block.body.txs[i];
            for (uint j = 0; j < transaction.inflow.length; j++) {
                nullifiers[index++] = transaction.inflow[j].nullifier;
            }
        }
        require(index == numOfNullifiers, "Invalid length of the nullifiers");

        /// Get rolled up root
        SMT254.OPRU memory proof = Layer2.proof.ofNullifierRollUp[nullifierRollUpId];
        bool isValidRollUp = proof.verify(
            _parentHeader.nullifierRoot,
            _block.header.nullifierRoot,
            RollUpLib.merge(bytes32(0), nullifiers)
        );

        return Challenge(
            !isValidRollUp,
            _block.header.proposer,
            "Nullifier roll up"
        );
    }

    function _challengeResultOfWithdrawalRollUp(
        Block memory _block,
        Header memory _parentHeader,
        uint withdrawalRollUpId,
        uint numOfWithdrawals
    )
        internal
        view
        returns (Challenge memory)
    {
        require(_block.header.parentBlock == _parentHeader.hash(), "Invalid prev header");
        /// Assign a new array
        bytes32[] memory withdrawals = new bytes32[](numOfWithdrawals);
        /// Append Withdrawal notes from transactions
        uint index = 0;
        for (uint i = 0; i < _block.body.txs.length; i++) {
            Transaction memory transaction = _block.body.txs[i];
            for(uint j = 0; j < transaction.outflow.length; j++) {
                if(transaction.outflow[j].outflowType == uint8(OutflowType.Withdrawal)) {
                    withdrawals[index++] = transaction.outflow[j].withdrawalNote();
                }
            }
        }
        require(numOfWithdrawals == index, "Submitted invalid num of utxo num");
        /// Withdrawal tree flushed
        if (_parentHeader.withdrawalIndex + numOfWithdrawals > MAX_WITHDRAWAL) {
            return Challenge(
                true,
                _block.header.proposer,
                "Withdrawal tree flushed"
            );
        }
        /// Submitted invalid index of the next withdrawal tree
        if (_block.header.withdrawalIndex != (_parentHeader.withdrawalIndex + numOfWithdrawals)) {
            return Challenge(
                true,
                _block.header.proposer,
                "Invalid withdrawal index"
            );
        }

        /// Check validity of the roll up using the storage based Keccak sub-tree roll up
        SplitRollUp memory proof = Layer2.proof.ofWithdrawalRollUp[withdrawalRollUpId];
        uint[] memory uintLeaves;
        assembly {
            uintLeaves := withdrawals
        }
        bool isValidRollUp = proof.verify(
            SubTreeRollUpLib.newSubTreeOPRU(
                uint(_parentHeader.withdrawalRoot),
                _parentHeader.withdrawalIndex,
                uint(_block.header.withdrawalRoot),
                WITHDRAWAL_SUB_TREE_DEPTH,
                uintLeaves
            )
        );

        return Challenge(
            !isValidRollUp,
            _block.header.proposer,
            "Withdrawal roll up"
        );
    }
}
