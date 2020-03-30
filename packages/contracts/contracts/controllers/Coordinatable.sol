pragma solidity >= 0.6.0;

import { Layer2 } from "../storage/Layer2.sol";
import {
    Proposer,
    Blockchain,
    Block,
    Proposal,
    Finalization,
    MassDeposit,
    Withdrawable,
    Types
} from "../libraries/Types.sol";
import { Deserializer } from "../libraries/Deserializer.sol";


contract Coordinatable is Layer2 {
    using Types for *;

    event NewProposal(bytes32 submissionId);
    event Finalized(bytes32 submissionId);
    event MassDepositCommit(uint id, bytes32 merged, uint256 fee);

    function register() public payable {
        require(msg.value >= MINIMUM_STAKE, "Should stake more than minimum amount of ETH");
        Proposer storage proposer = Layer2.chain.proposers[msg.sender];
        proposer.stake += msg.value;
    }

    function deregister() public {
        address payable proposerAddr = msg.sender;
        Proposer storage proposer = Layer2.chain.proposers[proposerAddr];
        require(proposer.exitAllowance <= block.number, "Still in the challenge period");
        /// Withdraw stake
        proposerAddr.transfer(proposer.stake);
        /// Withdraw reward
        payable(proposerAddr).transfer(proposer.reward);
        /// Delete proposer
        delete Layer2.chain.proposers[proposerAddr];
    }

    function propose(bytes memory) public {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        /// The message sender address should be same with the proposer address
        require(_block.header.proposer == msg.sender, "Coordinator account is different with the message sender");
        Proposer storage proposer = Layer2.chain.proposers[msg.sender];
        /// Check permission
        require(isProposable(msg.sender), "Not allowed to propose");
        /// Duplicated proposal is not allowed
        require(Layer2.chain.proposals[_block.submissionId].headerHash == bytes32(0), "Already submitted");
        /** LEGACY
        /// Do not exceed maximum challenging cost
        require(_block.maxChallengeCost() < CHALLENGE_LIMIT, "Its challenge cost exceeds the limit");
        */
        /// Save opru proposal
        bytes32 currentBlockHash = _block.header.hash();
        Layer2.chain.proposals[_block.submissionId] = Proposal(
            currentBlockHash,
            block.number + CHALLENGE_PERIOD,
            false
        );
        /// Record l2 chain
        Layer2.chain.parentOf[currentBlockHash] = _block.header.parentBlock;
        /// Record reference for the inclusion proofs
        Layer2.chain.utxoRootOf[currentBlockHash] = _block.header.nextUTXORoot;
        /// Update exit allowance period
        proposer.exitAllowance = block.number + CHALLENGE_PERIOD;
        /// Freeze the latest mass deposit for the next block proposer
        Layer2.chain.committedDeposits[Layer2.chain.stagedDeposits.hash()] += 1;
        emit MassDepositCommit(
            Layer2.chain.massDepositId,
            Layer2.chain.stagedDeposits.merged,
            Layer2.chain.stagedDeposits.fee
        );
        delete Layer2.chain.stagedDeposits;
        delete Layer2.chain.stagedSize;
        Layer2.chain.massDepositId++;
        emit NewProposal(_block.submissionId);
    }

    function finalize(bytes memory) public {
        Finalization memory finalization = Deserializer.finalizationFromCalldataAt(0);
        Proposal storage proposal = Layer2.chain.proposals[finalization.submissionId];
        /// Check requirements
        require(finalization.massDeposits.root() == finalization.header.depositRoot, "Submitted different deposit root");
        require(finalization.massMigrations.root() == finalization.header.migrationRoot, "Submitted different deposit root");
        require(finalization.header.hash() == proposal.headerHash, "Invalid header data");
        require(!proposal.slashed, "Slashed roll up can't be finalized");
        require(finalization.header.parentBlock == Layer2.chain.latest, "The latest block should be its parent");

        uint totalFee = finalization.header.fee;
        /// Execute deposits and collect fees
        for (uint i = 0; i < finalization.massDeposits.length; i++) {
            MassDeposit memory deposit = finalization.massDeposits[i];
            require(chain.committedDeposits[deposit.hash()] > 0, "MassDeposit does not exist.");
            totalFee += deposit.fee;
            chain.committedDeposits[deposit.hash()] -= 1;
        }

        /// Update withdrawable every finalization
        require(Layer2.chain.withdrawables.length >= 2, "not initialized blockchain");
        Withdrawable storage latest = Layer2.chain.withdrawables[Layer2.chain.withdrawables.length - 1];
        require(latest.root == finalization.header.prevWithdrawalRoot, "Different withdrawal tree");
        require(latest.index == finalization.header.prevWithdrawalIndex, "Different withdrawal tree");
        if (finalization.header.prevWithdrawalIndex > finalization.header.nextWithdrawalIndex) {
            /// Fully filled. Start a new withdrawal tree
            Layer2.chain.withdrawables.push();
        }
        Withdrawable storage target = Layer2.chain.withdrawables[Layer2.chain.withdrawables.length - 1];
        target.root = finalization.header.nextWithdrawalRoot;
        target.index = finalization.header.nextWithdrawalIndex;

        /// Update the daily snapshot of withdrawable tree to prevent race conditions
        if (Layer2.chain.snapshotTimestamp + 1 days < now) {
            Layer2.chain.snapshotTimestamp = now;
            Layer2.chain.withdrawables[0].root = target.root;
            Layer2.chain.withdrawables[0].index = target.index;
        }

        /// Record mass migrations and collect fees.
        /// A MassMigration becomes a MassDeposit for the migration destination.
        for (uint i = 0; i < finalization.massMigrations.length; i++) {
            bytes32 migrationId = keccak256(
                abi.encodePacked(
                    finalization.submissionId,
                    finalization.massMigrations[i].hash()
                )
            );
            require(!Layer2.chain.migrations[migrationId], "Same id exists. Migrate it first");
            Layer2.chain.migrations[migrationId] = true;
        }

        /// Give fee to the proposer
        Proposer storage proposer = Layer2.chain.proposers[finalization.header.proposer];
        proposer.reward += totalFee;

        /// Update the chain
        Layer2.chain.latest = proposal.headerHash;
        emit Finalized(finalization.submissionId);
    }

    function withdrawReward(uint amount) public {
        address payable proposerAddr = msg.sender;
        Proposer storage proposer = Layer2.chain.proposers[proposerAddr];
        require(proposer.reward >= amount, "You can't withdraw more than you have");
        payable(proposerAddr).transfer(amount);
        proposer.reward -= amount;
    }

    function isProposable(address proposerAddr) public view returns (bool) {
        Proposer memory  proposer = Layer2.chain.proposers[proposerAddr];
        /// You can add more consensus logic here
        if (proposer.stake <= MINIMUM_STAKE) {
            return false;
        } else {
            return true;
        }
    }
}

///  TODO - If the gas usage exceeds the challenge limit, the proposer will get slashed
///  TODO - instant withdrawal
///  TODO - guarantee of tx including
///  Some thoughts - There exists a possibility of racing condition to get the slash reward
