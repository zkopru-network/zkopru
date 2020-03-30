pragma solidity >= 0.6.0;

import { Deserializer } from "../../libraries/Deserializer.sol";
import { Block, Inflow, Outflow, PublicData, Proof } from "../../libraries/Types.sol";

contract DeserializationTester {
    function getProposer(bytes calldata) external pure returns (address) {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        return _block.header.proposer;
    }

    function getParentBlock(bytes calldata) external pure returns (bytes32) {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        return _block.header.parentBlock;
    }

    function getUTXORollUp(bytes calldata)
    external
    pure
    returns (
        uint256 prevRoot,
        uint256 prevIndex,
        uint256 nextRoot,
        uint256 nextIndex
    ) {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        prevRoot = _block.header.prevUTXORoot;
        prevIndex = _block.header.prevUTXOIndex;
        nextRoot = _block.header.nextUTXORoot;
        nextIndex = _block.header.nextUTXOIndex;
    }

    function getNullifierRollUp(bytes calldata)
    external
    pure
    returns (
        bytes32 prevRoot,
        bytes32 nextRoot
    ) {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        prevRoot = _block.header.prevNullifierRoot;
        nextRoot = _block.header.nextNullifierRoot;
    }

    function getWithdrawalRollUp(bytes calldata)
    external
    pure
    returns (
        bytes32 prevRoot,
        uint256 prevIndex,
        bytes32 nextRoot,
        uint256 nextIndex
    ) {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        prevRoot = _block.header.prevWithdrawalRoot;
        prevIndex = _block.header.prevWithdrawalIndex;
        nextRoot = _block.header.nextWithdrawalRoot;
        nextIndex = _block.header.nextWithdrawalIndex;
    }

    function getTxRoot(bytes calldata) external pure returns (bytes32) {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        return _block.header.txRoot;
    }

    function getMassDepositRoot(bytes calldata) external pure returns (bytes32) {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        return _block.header.depositRoot;
    }

    function getMassMigrationRoot(bytes calldata) external pure returns (bytes32) {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        return _block.header.migrationRoot;
    }

    function getTxInflow(
        uint txIndex,
        uint inflowIndex,
        bytes calldata
    ) external pure returns (
        uint256 inclusionRoot,
        bytes32 nullifier
    ) {
        Block memory _block = Deserializer.blockFromCalldataAt(1);
        Inflow memory inflow = _block.body.txs[txIndex].inflow[inflowIndex];
        inclusionRoot = inflow.inclusionRoot;
        nullifier = inflow.nullifier;
    }

    function getTxOutflow(
        uint txIndex,
        uint outflowIndex,
        bytes calldata
    ) external pure returns (
        uint256 note,
        address to,
        uint256 eth,
        address token,
        uint256 amount,
        uint256 nft,
        uint256 fee
    ) {
        Block memory _block = Deserializer.blockFromCalldataAt(1);
        Outflow memory outflow = _block.body.txs[txIndex].outflow[outflowIndex];
        note = outflow.note;
        to = outflow.publicData.to;
        eth = outflow.publicData.eth;
        token = outflow.publicData.token;
        amount = outflow.publicData.amount;
        nft = outflow.publicData.nft;
        fee = outflow.publicData.fee;
    }

    function getTxSwap(uint txIndex) external pure returns (uint256) {
        Block memory _block = Deserializer.blockFromCalldataAt(1);
        return _block.body.txs[txIndex].swap;
    }

    function getProof(uint txIndex) external pure returns (uint256[8] memory proof) {
        Block memory _block = Deserializer.blockFromCalldataAt(1);
        Proof memory _proof = _block.body.txs[txIndex].proof;
        proof = [_proof.a.X, _proof.a.Y, _proof.b.X[0], _proof.b.X[1], _proof.b.Y[0], _proof.b.Y[1], _proof.c.X, _proof.c.Y];
    }

    function getTxFee(uint txIndex) external pure returns (uint256) {
        Block memory _block = Deserializer.blockFromCalldataAt(1);
        return _block.body.txs[txIndex].fee;
    }
}