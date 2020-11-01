// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import { Storage } from "../storage/Storage.sol";
import { Deserializer } from "../libraries/Deserializer.sol";
import {
    Proposer,
    Proposal
} from "../libraries/Types.sol";

contract Challengeable is Storage {
    event Slash(bytes32 blockHash, address proposer, string reason);

    /**
     * @dev This is a proxy contract of proxy. The challenger will send a transaction to the
     *      main contract Zkopru.sol, then it will redirect its challenge txs to
     *      this contract. Then, this contract will check its gas usage using delegatecall by
     *      redirecting the tx to the corresponding validator contract.
     *      1. Zkopru.sol => Challengeable.sol
     *         : Pass storage using delegate call
     *      2. Challengeable.sol => XXXValidator.sol
     *         : Pass storage and validate the challenge. It also measure gas consumption.
     *
     *      You can see the connected validators at contracts/controllers/validators/*.sol
     *      Note that every validation function should pass l2 blockdata for its 1st parameter.
     */
    fallback() external payable {
        // Get corresponding validator
        address validator = Storage.validators[msg.sig];
        require(validator != address(0), "There is no proxy contract");
        // Run validation. Here it uses delegatecall to measure the gas consumption regardless of its revert.
        uint256 startingGas = gasleft();
        (bool success, bytes memory result) = validator.delegatecall(msg.data);
        uint256 usedGasForValidation = startingGas - gasleft();
        // Check validation result
        bool slash;
        string memory reason;
        if (success) {
            (slash, reason) = abi.decode(result, (bool, string));
        }
        // Check validation gas limit
        bool gasExceeds = usedGasForValidation > MAX_VALIDATION_GAS;
        if (gasExceeds) {
            (slash, reason) = (true, "Exceeds maximum gas for validation process");
        }
        // Execute slash
        require(slash, success ? "Couldn't find slash condition" : string(result));
        _execute(reason);
    }

    receive() external payable {
        revert("This contract does not receive ETH");
    }

    /**
     * @dev This function should be executed for the registered validation functions
     *      that accept the l2 blockdata for its 1st parameter.
     */
    function _execute(string memory reason) internal {
        bytes32 proposalId = Deserializer.proposalIdFromCalldata(0);
        address proposer = Deserializer.proposerAddressFromCalldata(0);
        Proposal storage proposal = Storage.chain.proposals[proposalId];
        // Check basic challenge conditions
        _checkChallengeCondition(proposal);
        // Since the challenge satisfies the given conditions, slash the optimistic rollup proposer
        Storage.chain.slashed[proposal.headerHash] = true; // Record it as slashed;
        _forfeitAndReward(proposer, msg.sender);
        // Emit event
        Storage.chain.slashed[proposal.headerHash] = true;
        emit Slash(proposal.headerHash, proposer, reason);
    }

    // Duplicated codes: solidity does not allow linear inheritance
    function _checkChallengeCondition(Proposal storage proposal) internal view {
        // Check the optimistic roll up is in the challenge period
        require(proposal.challengeDue > block.number, "Out of challenge period");
        // Check it is already slashed
        require(!Storage.chain.slashed[proposal.headerHash], "Already slashed");
        // Check the optimistic rollup exists
        require(proposal.headerHash != bytes32(0), "Does not exist");
    }

    function _forfeitAndReward(address proposerAddr, address challenger) internal {
        Proposer storage proposer = Storage.chain.proposers[proposerAddr];
        // Reward
        uint256 challengeReward = proposer.stake * 2 / 3;
        payable(challenger).transfer(challengeReward);
        // Forfeit
        proposer.stake = 0;
        proposer.reward = 0;
        // Delete proposer
        delete Storage.chain.proposers[proposerAddr];
    }
}
