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
    OutflowType,
    Header,
    Types
} from "../../libraries/Types.sol";
import { Deserializer } from "../../libraries/Deserializer.sol";

contract WithdrawalTreeChallenge is Challengeable {
    using Types for Header;

    function challengeWithdrawalIndex(
        bytes calldata, // serialized parent header
        bytes calldata blockData // serialized block data
    ) external {
        bytes32 proposalId = keccak256(blockData);
        Header memory parentHeader = Deserializer.headerFromCalldataAt(0);
        Block memory l2Block = Deserializer.blockFromCalldataAt(1);
        Challenge memory result = _challengeResultOfWithdrawalIndex(
            l2Block,
            parentHeader
        );
        _execute(proposalId, result);
    }

    function challengeWithdrawalRoot(
        uint256[] calldata initialSiblings,
        bytes calldata, // serialized parent header
        bytes calldata blockData // serialized block data
    ) external {
        bytes32 proposalId = keccak256(blockData);
        Header memory parentHeader = Deserializer.headerFromCalldataAt(1);
        Block memory l2Block = Deserializer.blockFromCalldataAt(2);
        uint256[] memory withdrawals = _getWithdrawals(
            l2Block.header.withdrawalIndex - parentHeader.withdrawalIndex,
            l2Block.body.txs
        );
        Challenge memory result = _challengeResultOfWithdrawalRoot(
            l2Block,
            parentHeader,
            withdrawals,
            initialSiblings
        );
        _execute(proposalId, result);
    }

    /** Computes challenge here */
    function _getWithdrawals(
        uint256 numOfWithdrawals,
        Transaction[] memory txs
    ) private pure returns (uint256[] memory withdrawals) {
        withdrawals = new uint256[](numOfWithdrawals);
        uint256 index = 0;
        // Append UTXOs from transactions
        for (uint256 i = 0; i < txs.length; i++) {
            Transaction memory transaction = txs[i];
            for(uint256 j = 0; j < transaction.outflow.length; j++) {
                if(txs[i].outflow[j].outflowType == uint8(OutflowType.Withdrawal)) {
                    withdrawals[index++] = transaction.outflow[j].note;
                }
            }
        }
        require(numOfWithdrawals == index, "Run index challenge");
    }

    function _challengeResultOfWithdrawalIndex(
        Block memory l2Block,
        Header memory parentHeader
    )
        internal
        pure
        returns (Challenge memory)
    {
        require(l2Block.header.parentBlock == parentHeader.hash(), "Invalid prev header");
        uint256 withdrawalLen = 0;
        // Get withdrawals from transactions
        for (uint256 i = 0; i < l2Block.body.txs.length; i++) {
            for(uint256 j = 0; j < l2Block.body.txs[i].outflow.length; j++) {
                if(l2Block.body.txs[i].outflow[j].outflowType == uint8(OutflowType.Withdrawal)) {
                    withdrawalLen += 1;
                }
            }
        }
        if (withdrawalLen != l2Block.header.withdrawalIndex - parentHeader.withdrawalIndex) {
            return Challenge(
                true,
                l2Block.header.proposer,
                "Invalid withdrawal index"
            );
        } else if (l2Block.header.withdrawalIndex > MAX_WITHDRAWAL) {
            return Challenge(
                true,
                l2Block.header.proposer,
                "withdrawal tree flushed"
            );
        }
    }

    function _challengeResultOfWithdrawalRoot(
        Block memory l2Block,
        Header memory parentHeader,
        uint256[] memory withdrawals,
        uint256[] memory initialSiblings
    )
        internal
        pure
        returns (Challenge memory)
    {
        require(l2Block.header.parentBlock == parentHeader.hash(), "Invalid prev header");
        // Check validity of the roll up using the storage based Poseidon sub-tree roll up
        uint256 computedRoot = SubTreeRollUpLib.rollUpSubTree(
            Hash.keccak(),
            parentHeader.withdrawalRoot,
            parentHeader.withdrawalIndex,
            WITHDRAWAL_SUB_TREE_DEPTH,
            withdrawals,
            initialSiblings
        );
        // Computed new utxo root is different with the submitted
        return Challenge(
            computedRoot != l2Block.header.withdrawalRoot,
            l2Block.header.proposer,
            "Withdrawal tree root"
        );
    }
}
