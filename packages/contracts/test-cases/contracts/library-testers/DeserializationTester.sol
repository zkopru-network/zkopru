// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.7.4;

import { Deserializer } from "../../target/zkopru/libraries/Deserializer.sol";
import {
    Finalization,
    Block,
    Inflow,
    Outflow,
    PublicData,
    Proof,
    Transaction,
    MassDeposit,
    MassMigration,
    Types
} from "../../target/zkopru/libraries/Types.sol";

contract DeserializationTester {
    using Types for MassDeposit[];
    using Types for MassMigration[];
    using Types for Transaction[];
    using Types for Transaction;

    function getProposer(bytes calldata) external pure returns (address) {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        return _block.header.proposer;
    }

    function getProposer2(
        uint256,
        uint256,
        bytes calldata
    ) external pure returns (address) {
        Block memory _block = Deserializer.blockFromCalldataAt(2);
        return _block.header.proposer;
    }

    function getProposalChecksum(bytes calldata _data)
        external
        pure
        returns (bytes32)
    {
        return keccak256(_data);
    }

    function getParentBlock(bytes calldata) external pure returns (bytes32) {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        return _block.header.parentBlock;
    }

    function getParentBlock2(
        uint256,
        uint256,
        uint256,
        bytes calldata
    ) external pure returns (bytes32) {
        Block memory _block = Deserializer.blockFromCalldataAt(3);
        return _block.header.parentBlock;
    }

    function getUTXORollUp(bytes calldata)
        external
        pure
        returns (uint256 root, uint256 index)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        root = _block.header.utxoRoot;
        index = _block.header.utxoIndex;
    }

    function getNullifierRollUp(bytes calldata)
        external
        pure
        returns (bytes32 root)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        root = _block.header.nullifierRoot;
    }

    function getWithdrawalRollUp(bytes calldata)
        external
        pure
        returns (uint256 root, uint256 index)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        root = _block.header.withdrawalRoot;
        index = _block.header.withdrawalIndex;
    }

    function getTxRoot(bytes calldata) external pure returns (bytes32) {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        return _block.header.txRoot;
    }

    function getMassDepositRoot(bytes calldata)
        external
        pure
        returns (bytes32)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        return _block.header.depositRoot;
    }

    function getMassMigrationRoot(bytes calldata)
        external
        pure
        returns (bytes32)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        return _block.header.migrationRoot;
    }

    function getTxsLen(bytes calldata) external pure returns (uint256 len) {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        return _block.body.txs.length;
    }

    function getTxInflowLen(uint256 txIndex, bytes calldata)
        external
        pure
        returns (uint256)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(1);
        return _block.body.txs[txIndex].inflow.length;
    }

    function getTxInflow(
        uint256 txIndex,
        uint256 inflowIndex,
        bytes calldata
    ) external pure returns (uint256 inclusionRoot, bytes32 nullifier) {
        Block memory _block = Deserializer.blockFromCalldataAt(2);
        Inflow memory inflow = _block.body.txs[txIndex].inflow[inflowIndex];
        inclusionRoot = inflow.inclusionRoot;
        nullifier = inflow.nullifier;
    }

    function getTxOutflow(
        uint256 txIndex,
        uint256 outflowIndex,
        bytes calldata
    )
        external
        pure
        returns (
            uint256 note,
            address to,
            uint256 eth,
            address token,
            uint256 amount,
            uint256 nft,
            uint256 fee
        )
    {
        Block memory _block = Deserializer.blockFromCalldataAt(2);
        Outflow memory outflow = _block.body.txs[txIndex].outflow[outflowIndex];
        note = outflow.note;
        to = outflow.publicData.to;
        eth = outflow.publicData.eth;
        token = outflow.publicData.token;
        amount = outflow.publicData.amount;
        nft = outflow.publicData.nft;
        fee = outflow.publicData.fee;
    }

    function getTxSwap(uint256 txIndex, bytes calldata)
        external
        pure
        returns (uint256)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(1);
        return _block.body.txs[txIndex].swap;
    }

    function getProof(uint256 txIndex, bytes calldata)
        external
        pure
        returns (uint256[8] memory proof)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(1);
        Proof memory _proof = _block.body.txs[txIndex].proof;
        proof = [
            _proof.a.X,
            _proof.a.Y,
            _proof.b.X[0],
            _proof.b.X[1],
            _proof.b.Y[0],
            _proof.b.Y[1],
            _proof.c.X,
            _proof.c.Y
        ];
    }

    function getTxFee(uint256 txIndex, bytes calldata)
        external
        pure
        returns (uint256)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(1);
        return _block.body.txs[txIndex].fee;
    }

    function getTxHash(uint256 txIndex, bytes calldata)
        external
        pure
        returns (bytes32)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(1);
        return _block.body.txs[txIndex].hash();
    }

    function getMassDepositsLen(bytes calldata)
        external
        pure
        returns (uint256 len)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        return _block.body.massDeposits.length;
    }

    function getMassDeposit(uint256 index, bytes calldata)
        external
        pure
        returns (bytes32 merged, uint256 fee)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(1);
        merged = _block.body.massDeposits[index].merged;
        fee = _block.body.massDeposits[index].fee;
    }

    function getMassMigrationsLen(bytes calldata)
        external
        pure
        returns (uint256 len)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        return _block.body.massMigrations.length;
    }

    function getMassMigration(uint256 index, bytes calldata)
        external
        pure
        returns (
            address destination,
            uint256 eth,
            address token,
            uint256 amount,
            bytes32 merged,
            uint256 fee
        )
    {
        Block memory _block = Deserializer.blockFromCalldataAt(1);
        destination = _block.body.massMigrations[index].destination;
        eth = _block.body.massMigrations[index].asset.eth;
        token = _block.body.massMigrations[index].asset.token;
        amount = _block.body.massMigrations[index].asset.amount;
        merged = _block.body.massMigrations[index].depositForDest.merged;
        fee = _block.body.massMigrations[index].depositForDest.fee;
    }

    function computeTxRoot(bytes calldata) external pure returns (bytes32) {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        return _block.body.txs.root();
    }

    function computeDepositRoot(bytes calldata)
        external
        pure
        returns (bytes32)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        return _block.body.massDeposits.root();
    }

    function computeMigrationRoot(bytes calldata)
        external
        pure
        returns (bytes32)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        return _block.body.massMigrations.root();
    }

    function getProposerFromFinalization(bytes calldata)
        external
        pure
        returns (address)
    {
        Finalization memory _finalization =
            Deserializer.finalizationFromCalldataAt(0);
        return _finalization.header.proposer;
    }

    function getProposer2FromFinalization(
        uint256,
        uint256,
        bytes calldata
    ) external pure returns (address) {
        Finalization memory _finalization =
            Deserializer.finalizationFromCalldataAt(2);
        return _finalization.header.proposer;
    }

    function getParentBlockFromFinalization(bytes calldata)
        external
        pure
        returns (bytes32)
    {
        Finalization memory _finalization =
            Deserializer.finalizationFromCalldataAt(0);
        return _finalization.header.parentBlock;
    }

    function getParentBlock2FromFinalization(
        uint256,
        uint256,
        uint256,
        bytes calldata
    ) external pure returns (bytes32) {
        Finalization memory _finalization =
            Deserializer.finalizationFromCalldataAt(3);
        return _finalization.header.parentBlock;
    }

    function getUTXORollUpFromFinalization(bytes calldata)
        external
        pure
        returns (uint256 root, uint256 index)
    {
        Finalization memory _finalization =
            Deserializer.finalizationFromCalldataAt(0);
        root = _finalization.header.utxoRoot;
        index = _finalization.header.utxoIndex;
    }

    function getNullifierRollUpFromFinalization(bytes calldata)
        external
        pure
        returns (bytes32 root)
    {
        Finalization memory _finalization =
            Deserializer.finalizationFromCalldataAt(0);
        root = _finalization.header.nullifierRoot;
    }

    function getWithdrawalRollUpFromFinalization(bytes calldata)
        external
        pure
        returns (uint256 root, uint256 index)
    {
        Finalization memory _finalization =
            Deserializer.finalizationFromCalldataAt(0);
        root = _finalization.header.withdrawalRoot;
        index = _finalization.header.withdrawalIndex;
    }

    function getTxRootFromFinalization(bytes calldata)
        external
        pure
        returns (bytes32)
    {
        Finalization memory _finalization =
            Deserializer.finalizationFromCalldataAt(0);
        return _finalization.header.txRoot;
    }

    function getMassDepositRootFromFinalization(bytes calldata)
        external
        pure
        returns (bytes32)
    {
        Finalization memory _finalization =
            Deserializer.finalizationFromCalldataAt(0);
        return _finalization.header.depositRoot;
    }

    function getMassMigrationRootFromFinalization(bytes calldata)
        external
        pure
        returns (bytes32)
    {
        Finalization memory _finalization =
            Deserializer.finalizationFromCalldataAt(0);
        return _finalization.header.migrationRoot;
    }

    function getMassDepositsLenFromFinalization(bytes calldata)
        external
        pure
        returns (uint256 len)
    {
        Finalization memory _finalization =
            Deserializer.finalizationFromCalldataAt(0);
        return _finalization.massDeposits.length;
    }

    function getMassDepositFromFinalization(uint256 index, bytes calldata)
        external
        pure
        returns (bytes32 merged, uint256 fee)
    {
        Finalization memory _finalization =
            Deserializer.finalizationFromCalldataAt(1);
        merged = _finalization.massDeposits[index].merged;
        fee = _finalization.massDeposits[index].fee;
    }

    function computeDepositRootFromFinalization(bytes calldata)
        external
        pure
        returns (bytes32)
    {
        Finalization memory _finalization =
            Deserializer.finalizationFromCalldataAt(0);
        return _finalization.massDeposits.root();
    }
}
