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
        uint256 root,
        uint256 index
    ) {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        root = _block.header.utxoRoot;
        index = _block.header.utxoIndex;
    }

    function getNullifierRollUp(bytes calldata)
    external
    pure
    returns (
        bytes32 root
    ) {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        root = _block.header.nullifierRoot;
    }

    function getWithdrawalRollUp(bytes calldata)
    external
    pure
    returns (
        bytes32 root,
        uint256 index
    ) {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        root = _block.header.withdrawalRoot;
        index = _block.header.withdrawalIndex;
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
