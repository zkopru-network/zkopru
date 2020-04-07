pragma solidity >= 0.6.0;

import "../libraries/Types.sol";
import { Pairing } from "../libraries/Pairing.sol";
import { SNARKsVerifier } from "../libraries/SNARKs.sol";
import { Configurated } from "./Configurated.sol";
import { OPRU, SplitRollUp } from "merkle-tree-rollup/contracts/library/Types.sol";
import { SMT256 } from "smt-rollup/contracts/SMT.sol";

struct RollUpProofs {
    SplitRollUp[] ofUTXORollUp;
    SMT256.OPRU[] ofNullifierRollUp;
    SplitRollUp[] ofWithdrawalRollUp;
    mapping(uint8=>mapping(uint=>address)) permittedTo;
}

contract Layer2 is Configurated {
    /** State of the layer2 blockchain is maintained by the optimistic roll up */
    Blockchain chain;

    /** SNARKs verifying keys assigned by the setup wizard for each tx type */
    mapping(bytes32=>SNARKsVerifier.VerifyingKey) vks;

    /** Addresses allowed to migrate from. Setup wizard manages the list */
    mapping(address=>bool) allowedMigrants;

    /** Roll up proofs for challenge */
    RollUpProofs proof;

    function parentOf(bytes32 header) public view returns (bytes32) {
        return chain.parentOf[header];
    }

    function utxoRootOf(bytes32 header) public view returns (bytes32) {
        return bytes32(chain.utxoRootOf[header]);
    }

    function finalizedUTXOs(bytes32 utxoRoot) public view returns (bool) {
        return chain.finalizedUTXOs[uint(utxoRoot)];
    }

    function proposers(address addr) public view returns (uint stake, uint reward, uint exitAllowance) {
        Proposer memory proposer = chain.proposers[addr];
        stake = proposer.stake;
        reward = proposer.reward;
        exitAllowance = proposer.exitAllowance;
    }

    function proposals(bytes32 proposalId) public view returns (bytes32 header, uint challengeDue, bool slashed) {
        Proposal memory proposal = chain.proposals[proposalId];
        header = proposal.headerHash;
        challengeDue = proposal.challengeDue;
        slashed = proposal.slashed;
    }

    function stagedDeposits() public view returns (bytes32 merged, uint fee) {
        MassDeposit memory massDeposit = chain.stagedDeposits;
        merged = massDeposit.merged;
        fee = massDeposit.fee;
    }

    function stagedSize() public view returns (uint) {
        return chain.stagedSize;
    }

    function massDepositId() public view returns (uint) {
        return chain.massDepositId;
    }

    function committedDeposits(bytes32 massDepositHash) public view returns (uint) {
        return chain.committedDeposits[massDepositHash];
    }

    function withdrawables(uint idx) public view returns (bytes32 root, uint index) {
        Withdrawable memory withdrawable =  chain.withdrawables[idx];
        root = withdrawable.root;
        index = withdrawable.index;
    }

    function snapshotTimestamp() public view returns (uint) {
        return chain.snapshotTimestamp;
    }

    function withdrawn(bytes32 leaf) public view returns (bool) {
        return chain.withdrawn[leaf];
    }

    function migrations(bytes32 migrationHash) public view returns (bool) {
        return chain.migrations[migrationHash];
    }
}
