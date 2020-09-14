// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import { Layer2 } from "../../storage/Layer2.sol";
import { Challengeable } from "../Challengeable.sol";
import {
    Block,
    Transaction,
    MassDeposit,
    MassMigration,
    Challenge,
    Types
} from "../../libraries/Types.sol";
import { Deserializer } from "../../libraries/Deserializer.sol";

contract HeaderChallenge is Challengeable {
    using Types for MassDeposit[];
    using Types for MassMigration[];
    using Types for Transaction[];

    /**
     * @dev Challenge when the submitted header's deposit root is invalid.
     * @param blockData Serialized block data
     */
    function challengeDepositRoot(bytes calldata blockData) external {
        bytes32 proposalId = keccak256(blockData);
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        Challenge memory result = _challengeResultOfDepositRoot(_block);
        _execute(proposalId, result);
    }

    /**
     * @dev Challenge when the submitted header's transfer root is invalid.
     *      The transfer root in the header should be the merkle root of the transfer
     *      tx hash values.
     * @param blockData Serialized block data
     */
    function challengTxRoot(bytes calldata blockData) external {
        bytes32 proposalId = keccak256(blockData);
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        Challenge memory result = _challengeResultOfTxRoot(_block);
        _execute(proposalId, result);
    }

    /**
     * @dev Challenge when the submitted header's migration root is invalid.
     *      The migration root in the header should be the merkle root of the migration
     *      tx hash values.
     * @param blockData Serialized block data
     */
    function challengeMigrationRoot(bytes calldata blockData) external {
        bytes32 proposalId = keccak256(blockData);
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        Challenge memory result = _challengeResultOfMigrationRoot(_block);
        _execute(proposalId, result);
    }

    /**
     * @dev Challenge when the submitted header's total fee is not same with
     *      the sum of the fees in every transactions in the block.
     * @param blockData Serialized block data
     */
    function challengeTotalFee(bytes calldata blockData) external {
        bytes32 proposalId = keccak256(blockData);
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        Challenge memory result = _challengeResultOfTotalFee(_block);
        _execute(proposalId, result);
    }

    function _challengeResultOfDepositRoot(
        Block memory _block
    )
        internal
        pure
        returns (Challenge memory)
    {
        return Challenge(
            _block.header.depositRoot != _block.body.massDeposits.root(),
            _block.header.proposer,
            "Deposit root validation"
        );
    }

    function _challengeResultOfTxRoot(
        Block memory _block
    )
        internal
        pure
        returns (Challenge memory)
    {
        return Challenge(
            _block.header.txRoot != _block.body.txs.root(),
            _block.header.proposer,
            "Transaction root validation"
        );
    }

    function _challengeResultOfMigrationRoot(
        Block memory _block
    )
        internal
        pure
        returns (Challenge memory)
    {
        return Challenge(
            _block.header.migrationRoot != _block.body.massMigrations.root(),
            _block.header.proposer,
            "Transaction root validation"
        );
    }


    function _challengeResultOfTotalFee(
        Block memory _block
    )
        internal
        pure
        returns (Challenge memory)
    {
        uint256 totalFee = 0;
        for (uint256 i = 0; i < _block.body.massDeposits.length; i ++) {
            totalFee += _block.body.massDeposits[i].fee;
        }
        for (uint256 i = 0; i < _block.body.txs.length; i ++) {
            totalFee += _block.body.txs[i].fee;
        }
        // FYI, fee in the massMigration is for the destination contract
        return Challenge(
            totalFee != _block.header.fee,
            _block.header.proposer,
            "Total fee validation"
        );
    }
}
