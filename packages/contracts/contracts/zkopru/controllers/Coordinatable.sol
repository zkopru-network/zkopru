// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import { Storage } from "../storage/Storage.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC165 } from "@openzeppelin/contracts/introspection/IERC165.sol";
import { Hash } from "../libraries/Hash.sol";
import { IConsensusProvider } from "../../consensus/interfaces/IConsensusProvider.sol";
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


contract Coordinatable is Storage {
    using Types for *;

    event NewProposal(uint256 proposalNum, bytes32 blockHash);
    event Finalized(bytes32 blockHash);
    event MassDepositCommit(uint256 index, bytes32 merged, uint256 fee);
    event NewErc20(address tokenAddr);
    event NewErc721(address tokenAddr);

    /**
     * @notice This function will be updated as the governance of Zkopru's been updated.
     *         Currently Coordinator calls this function for the proof of stake.
     *         Coordinator should pay more than MINIMUM_STAKE. See 'Configurated.sol'
     */
    function register() public payable {
        stake(msg.sender);
    }

    function stake(address coordinator) public payable {
        require(msg.value >= MINIMUM_STAKE, "Should stake more than minimum amount of ETH");
        Proposer storage proposer = Storage.chain.proposers[coordinator];
        proposer.stake += msg.value;
    }

    /**
     * @notice This function will be updated as the governance of Zkopru's been updated.
     */
    function deregister() public {
        address payable proposerAddr = msg.sender;
        Proposer storage proposer = Storage.chain.proposers[proposerAddr];
        require(proposer.exitAllowance <= block.number, "Still in the challenge period");
        // Withdraw stake
        proposerAddr.transfer(proposer.stake);
        // Withdraw reward
        payable(proposerAddr).transfer(proposer.reward);
        // Delete proposer
        delete Storage.chain.proposers[proposerAddr];
    }

    /**
     * @dev Coordinator proposes a new block using this function. propose() will freeze
     *      the current mass deposit for the next block proposer, and will go through
     *      CHALLENGE_PERIOD.
     * @param data Serialized newly minted block data
     */
    function propose(bytes memory data) public {
        // Limit the maximum length
        require(data.length <= MAX_BLOCK_SIZE);
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        // The message sender address should be same with the proposer address
        require(_block.header.proposer == msg.sender, "Coordinator account is different with the message sender");
        Proposer storage proposer = Storage.chain.proposers[msg.sender];
        // Check permission
        IConsensusProvider(consensusProvider).openRoundIfNeeded();
        require(isProposable(msg.sender), "Not allowed to propose");
        // Duplicated proposal is not allowed
        bytes32 checksum = keccak256(data);
        require(Storage.chain.proposals[checksum].headerHash == bytes32(0), "Already submitted");
        // Save opru proposal
        bytes32 currentBlockHash = _block.header.hash();
        Storage.chain.proposals[checksum] = Proposal(
            currentBlockHash,
            block.number + CHALLENGE_PERIOD
        );
        // Record l2 chain
        Storage.chain.parentOf[currentBlockHash] = _block.header.parentBlock;
        // Record reference for the inclusion proofs
        Storage.chain.utxoRootOf[currentBlockHash] = _block.header.utxoRoot;
        // Record reference for the withdrawal proofs when only if there exists update
        if (Storage.chain.withdrawalRootOf[_block.header.parentBlock] != _block.header.withdrawalRoot) {
            Storage.chain.withdrawalRootOf[currentBlockHash] = _block.header.withdrawalRoot;
        }
        // Update exit allowance period
        proposer.exitAllowance = block.number + CHALLENGE_PERIOD;
        // Freeze the latest mass deposit for the next block proposer
        commitMassDeposit();
        emit NewProposal(Storage.chain.proposedBlocks, currentBlockHash);
        Storage.chain.proposedBlocks++;
    }

    /**
     * @dev Coordinator can commit mass deposits. The pending deposits will be automatically
     *      committed by propose() block. But to start the first propose() block, there
     *      should be enough pending deposits, and the coordinator will commit them using
     *      this standalone function.
     */
    function commitMassDeposit() public {
        if(Storage.chain.stagedDeposits.merged != bytes32(0)) {
            bytes32 depositHash = Storage.chain.stagedDeposits.hash();
            Storage.chain.committedDeposits[depositHash] += 1;
            emit MassDepositCommit(
                Storage.chain.massDepositId,
                Storage.chain.stagedDeposits.merged,
                Storage.chain.stagedDeposits.fee
            );
            delete Storage.chain.stagedDeposits;
            delete Storage.chain.stagedSize;
            Storage.chain.massDepositId++;
        }
    }

    /**
     * @dev Coordinator can finalize a submitted block if it isn't slashed during the
     *      challenge period. It updates the aggregated fee and withdrawal root.
     * @param // Block data without tx details
     */
    function finalize(bytes memory) public {
        Finalization memory finalization = Deserializer.finalizationFromCalldataAt(0);
        Proposal storage proposal = Storage.chain.proposals[finalization.proposalChecksum];
        // Check requirements
        require(finalization.massDeposits.root() == finalization.header.depositRoot, "Submitted different deposit root");
        require(finalization.massMigrations.root() == finalization.header.migrationRoot, "Submitted different deposit root");
        require(finalization.header.hash() == proposal.headerHash, "Invalid header data");
        require(!Storage.chain.slashed[proposal.headerHash], "Slashed roll up can't be finalized");
        require(!Storage.chain.finalized[proposal.headerHash], "Already finalized");
        require(finalization.header.parentBlock == Storage.chain.latest, "The latest block should be its parent");
        require(finalization.header.parentBlock != proposal.headerHash, "Reentrancy case");
        require(block.number > proposal.challengeDue, "Still in challenge period");

        // Execute deposits and collect fees
        for (uint256 i = 0; i < finalization.massDeposits.length; i++) {
            MassDeposit memory deposit = finalization.massDeposits[i];
            bytes32 massDepositHash = deposit.hash();
            require(Storage.chain.committedDeposits[massDepositHash] > 0, "MassDeposit does not exist.");
            Storage.chain.committedDeposits[massDepositHash] -= 1;
        }

        // Record mass migrations and collect fees.
        // A MassMigration becomes a MassDeposit for the migration destination.
        for (uint256 i = 0; i < finalization.massMigrations.length; i++) {
            bytes32 migrationId = keccak256(
                abi.encodePacked(
                    finalization.proposalChecksum,
                    finalization.massMigrations[i].hash()
                )
            );
            require(!Storage.chain.migrations[migrationId], "Same id exists. Migrate it first");
            Storage.chain.migrations[migrationId] = true;
        }

        // Give fee to the proposer
        Proposer storage proposer = Storage.chain.proposers[finalization.header.proposer];
        proposer.reward += finalization.header.fee;

        // Update the chain
        Storage.chain.finalized[proposal.headerHash] = true;
        Storage.chain.finalizedUTXORoots[finalization.header.utxoRoot] = true;
        Storage.chain.latest = proposal.headerHash;
        emit Finalized(proposal.headerHash);
        delete Storage.chain.proposals[finalization.proposalChecksum];
    }

    /**
     * @dev Coordinators can withdraw aggregated transaction fees.
     * @param amount Amount to withdraw.
     */
    function withdrawReward(uint256 amount) public {
        address payable proposerAddr = msg.sender;
        Proposer storage proposer = Storage.chain.proposers[proposerAddr];
        require(proposer.reward >= amount, "You can't withdraw more than you have");
        payable(proposerAddr).transfer(amount);
        proposer.reward -= amount;
    }


    bytes4 private constant _INTERFACE_ID_ERC721 = 0x80ac58cd;

    /**
     * @dev Provide registered erc20 token information for decryption
     * TODO
     * 1. verify erc20 token
     * 2. governance to register the token address
     */
    function registerERC20(address tokenAddr) public {
        require(!Storage.chain.registeredERC20s[tokenAddr], "Already registered");
        // Make sure that this token is ERC20
        try IERC20(tokenAddr).transfer(address(this), 0) returns (bool result) {
            require(result, "Failed to send dummy tx");
        } catch Error(string memory reason) {
            revert(reason);
        } catch (bytes memory /*reason*/) {
            // pass: it means that this address is not ERC721
            revert("does not support transfer()");
        }
        try IERC20(tokenAddr).transferFrom(address(this), address(this), 0) returns (bool result) {
            require(result, "Failed to send dummy tx");
        } catch Error(string memory reason) {
            revert(reason);
        } catch (bytes memory /*reason*/) {
            // pass: it means that this address is not ERC721
            revert("does not support transfer()");
        }
        try IERC20(tokenAddr).balanceOf(address(this)) returns (uint256) {
            // success
        } catch Error(string memory reason) {
            revert(reason);
        } catch (bytes memory /*reason*/) {
            // pass: it means that this address is not ERC721
            revert("does not support transfer()");
        }
        // Make sure that this token is not an ERC721
        try IERC165(tokenAddr).supportsInterface(_INTERFACE_ID_ERC721) returns (bool erc721) {
            require(!erc721, "This address seems an ERC721 contract");
        } catch Error(string memory /*reason*/) {
            // success
        } catch (bytes memory /*reason*/) {
            // success
        }
        Storage.chain.registeredERC20s[tokenAddr] = true;
        emit NewErc20(tokenAddr);
    }

    /**
     * @dev Provide registered erc20 token information for decryption
     * 1. verify erc721 token
     * 2. governance to register the token address
     */
    function registerERC721(address tokenAddr) public {
        require(!Storage.chain.registeredERC721s[tokenAddr], "Already registered");
        // Make sure that this token is an ERC721
        try IERC165(tokenAddr).supportsInterface(_INTERFACE_ID_ERC721) returns (bool erc721) {
            require(erc721, "This address is not an ERC721 contract");
        } catch Error(string memory reason) {
            revert(reason);
        } catch (bytes memory reason) {
            revert(string(reason));
        }
        Storage.chain.registeredERC721s[tokenAddr] = true;
        emit NewErc721(tokenAddr);
    }

    /**
     * @dev You can override this function to implement your own consensus logic.
     * @param proposerAddr Coordinator address to check the allowance of block proposing.
     */
    function isProposable(address proposerAddr) public view returns (bool) {
        Proposer memory  proposer = Storage.chain.proposers[proposerAddr];
        // You can add more consensus logic here
        if (proposer.stake >= MINIMUM_STAKE) {
            return IConsensusProvider(consensusProvider).isProposable(proposerAddr);
        } else {
            return false;
        }
    }
}

//  TODO - If the gas usage exceeds the challenge limit, the proposer will get slashed
//  TODO - instant withdrawal
//  TODO - guarantee of tx including
//  Some thoughts - There exists a possibility of racing condition to get the slash reward
