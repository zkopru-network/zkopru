pragma solidity >= 0.6.0;

import { Layer2 } from "../storage/Layer2.sol";
import { Hash } from "../libraries/Hash.sol";
import {
    Header,
    Proposer,
    Blockchain,
    Block,
    Proposal,
    Finalization,
    MassDeposit,
    WithdrawalTree,
    Types
} from "../libraries/Types.sol";
import { Deserializer } from "../libraries/Deserializer.sol";


contract Coordinatable is Layer2 {
    using Types for *;

    event NewProposal(uint256 proposalNum, bytes32 blockHash);
    event Finalized(bytes32 blockHash);
    event MassDepositCommit(uint index, bytes32 merged, uint256 fee);

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
        require(Layer2.chain.proposals[_block.checksum].headerHash == bytes32(0), "Already submitted");
        /** LEGACY
        /// Do not exceed maximum challenging cost
        require(_block.maxChallengeCost() < CHALLENGE_LIMIT, "Its challenge cost exceeds the limit");
        */
        /// Save opru proposal
        bytes32 currentBlockHash = _block.header.hash();
        Layer2.chain.proposals[_block.checksum] = Proposal(
            currentBlockHash,
            block.number + CHALLENGE_PERIOD,
            false
        );
        /// Record l2 chain
        Layer2.chain.parentOf[currentBlockHash] = _block.header.parentBlock;
        /// Record reference for the inclusion proofs
        Layer2.chain.utxoRootOf[currentBlockHash] = _block.header.utxoRoot;
        /// Update exit allowance period
        proposer.exitAllowance = block.number + CHALLENGE_PERIOD;
        /// Freeze the latest mass deposit for the next block proposer
        commitMassDeposit();
        emit NewProposal(Layer2.chain.proposedBlocks, currentBlockHash);
        Layer2.chain.proposedBlocks++;
    }

    function commitMassDeposit() public {
        if(Layer2.chain.stagedDeposits.merged != bytes32(0)) {
            Layer2.chain.committedDeposits[Layer2.chain.stagedDeposits.hash()] += 1;
            emit MassDepositCommit(
                Layer2.chain.massDepositId,
                Layer2.chain.stagedDeposits.merged,
                Layer2.chain.stagedDeposits.fee
            );
            delete Layer2.chain.stagedDeposits;
            delete Layer2.chain.stagedSize;
            Layer2.chain.massDepositId++;
        }
    }

    function finalize(bytes memory) public {
        Finalization memory finalization = Deserializer.finalizationFromCalldataAt(0);
        Proposal storage proposal = Layer2.chain.proposals[finalization.proposalChecksum];
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

        WithdrawalTree storage latest = Layer2.chain.withdrawalTrees[Layer2.chain.withdrawalTrees.length - 1];
        if (latest.index > finalization.header.withdrawalIndex) {
            /// Fully filled. Start a new withdrawal tree
            Layer2.chain.withdrawalTrees.push();
        }
        WithdrawalTree storage target = Layer2.chain.withdrawalTrees[Layer2.chain.withdrawalTrees.length - 1];
        target.root = finalization.header.withdrawalRoot;
        target.index = finalization.header.withdrawalIndex;

        /// Update the daily snapshot of withdrawalTree tree to prevent race conditions
        Layer2.chain.wrIndex += 1;
        Layer2.chain.withdrawalRefs[Layer2.chain.wrIndex] = finalization.header.withdrawalRoot;

        /// Record mass migrations and collect fees.
        /// A MassMigration becomes a MassDeposit for the migration destination.
        for (uint i = 0; i < finalization.massMigrations.length; i++) {
            bytes32 migrationId = keccak256(
                abi.encodePacked(
                    finalization.proposalChecksum,
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
        emit Finalized(proposal.headerHash);
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
        if (proposer.stake >= MINIMUM_STAKE) {
            return true;
        } else {
            return false;
        }
    }
}

///  TODO - If the gas usage exceeds the challenge limit, the proposer will get slashed
///  TODO - instant withdrawal
///  TODO - guarantee of tx including
///  Some thoughts - There exists a possibility of racing condition to get the slash reward
