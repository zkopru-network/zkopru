// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import "../libraries/Types.sol";
import { SNARK } from "../libraries/SNARK.sol";
import { Storage } from "./Storage.sol";
import { SMT254 } from "../libraries/SMT.sol";

contract Reader is Storage {
    function genesis() public view returns (bytes32) {
        return chain.genesis;
    }

    function latest() public view returns (bytes32) {
        return chain.latest;
    }

    function proposedBlocks() public view returns (uint256) {
        return chain.proposedBlocks;
    }

    function parentOf(bytes32 header) public view returns (bytes32) {
        return chain.parentOf[header];
    }

    function utxoRootOf(bytes32 header) public view returns (uint256) {
        return chain.utxoRootOf[header];
    }

    function withdrawalRootOf(bytes32 header) public view returns (uint256) {
        return chain.withdrawalRootOf[header];
    }

    function finalizedUTXORoots(bytes32 utxoRoot) public view returns (bool) {
        return chain.finalizedUTXORoots[uint256(utxoRoot)];
    }

    function proposers(address addr) public view returns (uint256 stake, uint256 reward, uint256 exitAllowance) {
        Proposer memory proposer = chain.proposers[addr];
        stake = proposer.stake;
        reward = proposer.reward;
        exitAllowance = proposer.exitAllowance;
    }

    function proposals(bytes32 proposalId) public view returns (bytes32 header, uint256 challengeDue, bool slashed) {
        Proposal memory proposal = chain.proposals[proposalId];
        header = proposal.headerHash;
        challengeDue = proposal.challengeDue;
        slashed = chain.slashed[proposal.headerHash];
    }

    function stagedDeposits() public view returns (bytes32 merged, uint256 fee) {
        MassDeposit memory massDeposit = chain.stagedDeposits;
        merged = massDeposit.merged;
        fee = massDeposit.fee;
    }

    function stagedSize() public view returns (uint256) {
        return chain.stagedSize;
    }

    function massDepositId() public view returns (uint256) {
        return chain.massDepositId;
    }

    function committedDeposits(bytes32 massDepositHash) public view returns (uint256) {
        return chain.committedDeposits[massDepositHash];
    }

    function withdrawn(bytes32 leaf) public view returns (bool) {
        return chain.withdrawn[leaf];
    }

    function migrations(bytes32 migrationHash) public view returns (bool) {
        return chain.migrations[migrationHash];
    }

    function registeredERC20s(address tokenAddr) public view returns (bool) {
        return chain.registeredERC20s[tokenAddr];
    }

    function registeredERC721s(address tokenAddr) public view returns (bool) {
        return chain.registeredERC721s[tokenAddr];
    }

    function getVk(uint8 numOfInputs, uint8 numOfOutputs) public view returns (
        uint256[2] memory alpha1,
        uint256[2][2] memory beta2,
        uint256[2][2] memory gamma2,
        uint256[2][2] memory delta2,
        uint256[2][] memory ic
    ) {
        uint256 txSig = Types.getSNARKSignature(numOfInputs, numOfOutputs);
        SNARK.VerifyingKey memory vk = vks[txSig];
        alpha1[0] = vk.alpha1.X;
        alpha1[1] = vk.alpha1.Y;
        beta2[0] = vk.beta2.X;
        beta2[1] = vk.beta2.Y;
        gamma2[0] = vk.gamma2.X;
        gamma2[1] = vk.gamma2.Y;
        delta2[0] = vk.delta2.X;
        delta2[1] = vk.delta2.Y;
        ic = new uint256[2][](vk.ic.length);
        for(uint256 i = 0; i < vk.ic.length; i++) {
            ic[i] = [vk.ic[i].X, vk.ic[i].Y];
        }
    }

    function latestProposalBlock(address coordinator) public view returns (uint) {
        return Storage.chain.proposers[coordinator].exitAllowance - CHALLENGE_PERIOD;
    }
}
