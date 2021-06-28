// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.7.4;

import { Storage } from "../storage/Storage.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { IERC165 } from "@openzeppelin/contracts/introspection/IERC165.sol";
import { Hash } from "../libraries/Hash.sol";
import {
    IConsensusProvider
} from "../../consensus/interfaces/IConsensusProvider.sol";
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
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    event NewProposal(uint256 proposalNum, bytes32 blockHash);
    event Finalized(bytes32 blockHash);
    event MassDepositCommit(uint256 index, bytes32 merged, uint256 fee);
    event NewErc20(address tokenAddr);
    event NewErc721(address tokenAddr);
    event StakeChanged(address indexed coordinator);

    /**
     * @notice This function will be updated as the governance of Zkopru's been updated.
     *         Currently Coordinator calls this function for the proof of stake.
     *         Coordinator should pay more than MINIMUM_STAKE. See 'Configurated.sol'
     */
    function register() public payable {
        stake(msg.sender);
    }

    function stake(address coordinator) public payable {
        require(
            coordinator != address(0),
            "Cannot add ETH to the null address"
        );
        require(
            msg.value >= MINIMUM_STAKE,
            "Should stake more than minimum amount of ETH"
        );
        Proposer storage proposer = Storage.chain.proposers[coordinator];
        proposer.stake += msg.value;
        emit StakeChanged(coordinator);
    }

    /**
     * @notice This function will be updated as the governance of Zkopru's been updated.
     */
    function deregister() public {
        address payable proposerAddr = msg.sender;
        Proposer memory proposer = Storage.chain.proposers[proposerAddr];
        require(
            proposer.exitAllowance <= block.number,
            "Still in the challenge period"
        );
        // Delete proposer
        delete Storage.chain.proposers[proposerAddr];
        // Withdraw staked amount and reward
        payable(proposerAddr).transfer(proposer.stake.add(proposer.reward));
        emit StakeChanged(msg.sender);
    }

    /**
     * @dev Propose a block only after verifying that the parentHash exists and
     * is not slashed. Also verify that a list of mass deposit hashes exist.
     **/
    function safePropose(
        bytes memory data,
        bytes32 parentHash,
        bytes32[] memory depositHashes
    ) public {
        require(
            Storage.chain.proposals[parentHash].headerHash != bytes32(0),
            "Parent hash does not exist"
        );
        require(!Storage.chain.slashed[parentHash], "Parent hash is slashed");
        for (uint8 i = 0; i < depositHashes.length; i++) {
            require(
                Storage.chain.committedDeposits[depositHashes[i]] != 0,
                "Deposit hash does not exist"
            );
        }
        propose(data);
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
        require(
            _block.header.proposer == msg.sender,
            "Coordinator account is different with the message sender"
        );
        Proposer storage proposer = Storage.chain.proposers[msg.sender];
        // Check permission
        IConsensusProvider(consensusProvider).openRoundIfNeeded();
        require(isProposable(msg.sender), "Not allowed to propose");
        // Duplicated proposal is not allowed
        bytes32 checksum = keccak256(data);
        require(
            Storage.chain.proposals[checksum].headerHash == bytes32(0),
            "Already submitted"
        );
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
        if (
            Storage.chain.withdrawalRootOf[_block.header.parentBlock] !=
            _block.header.withdrawalRoot
        ) {
            Storage.chain.withdrawalRootOf[currentBlockHash] = _block
                .header
                .withdrawalRoot;
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
        if (Storage.chain.stagedDeposits.merged != bytes32(0)) {
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
        Finalization memory finalization =
            Deserializer.finalizationFromCalldataAt(0);
        Proposal storage proposal =
            Storage.chain.proposals[finalization.proposalChecksum];
        // Check requirements
        require(
            finalization.massDeposits.root() == finalization.header.depositRoot,
            "Submitted different deposit root"
        );
        require(
            finalization.header.hash() == proposal.headerHash,
            "Invalid header data"
        );
        require(
            !Storage.chain.slashed[proposal.headerHash],
            "Slashed roll up can't be finalized"
        );
        require(
            !Storage.chain.finalized[proposal.headerHash],
            "Already finalized"
        );
        require(
            finalization.header.parentBlock == Storage.chain.latest,
            "The latest block should be its parent"
        );
        require(
            finalization.header.parentBlock != proposal.headerHash,
            "Reentrancy case"
        );
        require(
            block.number > proposal.challengeDue,
            "Still in challenge period"
        );

        // Execute deposits and collect fees
        for (uint256 i = 0; i < finalization.massDeposits.length; i++) {
            MassDeposit memory deposit = finalization.massDeposits[i];
            bytes32 massDepositHash = deposit.hash();
            require(
                Storage.chain.committedDeposits[massDepositHash] > 0,
                "MassDeposit does not exist."
            );
            Storage.chain.committedDeposits[massDepositHash] -= 1;
        }

        // Record mass migrations
        if (finalization.header.migrationRoot != bytes32(0)) {
            require(
                Storage.chain.migrationRoots[
                    finalization.header.migrationRoot
                ] == false,
                "Migration root already exists."
            );
            Storage.chain.migrationRoots[
                finalization.header.migrationRoot
            ] = true;
        }

        // Give fee to the proposer
        Proposer storage proposer =
            Storage.chain.proposers[finalization.header.proposer];
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
        require(
            proposer.reward >= amount,
            "You can't withdraw more than you have"
        );
        proposer.reward -= amount;
        payable(proposerAddr).transfer(amount);
    }

    bytes4 private constant _INTERFACE_ID_ERC721 = 0x80ac58cd;

    /**
     * @dev Provide registered erc20 token information for decryption
     */
    function registerERC20(address tokenAddr) public {
        require(
            !Storage.chain.registeredERC20s[tokenAddr],
            "Already registered"
        );
        require(
            !Storage.chain.registeredERC721s[tokenAddr],
            "Registered as ERC721"
        );
        // Make sure that this token is ERC20
        IERC20(tokenAddr).safeTransfer(address(this), 0);
        IERC20(tokenAddr).safeTransferFrom(address(this), address(this), 0);
        IERC20(tokenAddr).balanceOf(address(this));
        Storage.chain.registeredERC20s[tokenAddr] = true;
        emit NewErc20(tokenAddr);
    }

    /**
     * @dev Provide registered erc20 token information for decryption
     * 1. verify erc721 token
     * 2. governance to register the token address
     */
    function registerERC721(address tokenAddr) public {
        require(
            !Storage.chain.registeredERC721s[tokenAddr],
            "Already registered"
        );
        require(
            !Storage.chain.registeredERC20s[tokenAddr],
            "Registered as ERC20"
        );
        // Make sure that this token is an ERC721
        try IERC165(tokenAddr).supportsInterface(_INTERFACE_ID_ERC721) returns (
            bool erc721
        ) {
            require(erc721, "This address is not an ERC721 contract");
        } catch {
            revert("This address is not an ERC721 contract");
        }
        Storage.chain.registeredERC721s[tokenAddr] = true;
        emit NewErc721(tokenAddr);
    }

    /**
     * @dev You can override this function to implement your own consensus logic.
     * @param proposerAddr Coordinator address to check the allowance of block proposing.
     */
    function isProposable(address proposerAddr) public view returns (bool) {
        Proposer memory proposer = Storage.chain.proposers[proposerAddr];
        // You can add more consensus logic here
        if (proposer.stake >= MINIMUM_STAKE) {
            return
                IConsensusProvider(consensusProvider).isProposable(
                    proposerAddr
                );
        } else {
            return false;
        }
    }
}
