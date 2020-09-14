// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import { Layer2 } from "../storage/Layer2.sol";
import {
    Challenge,
    Proposer,
    Proposal
} from "../libraries/Types.sol";

contract Challengeable is Layer2 {
    // Duplicated codes: solidity does not allow linear inheritance
    function _checkChallengeCondition(Proposal storage proposal) internal view {
        // Check the optimistic roll up is in the challenge period
        require(proposal.challengeDue > block.number, "Out of challenge period");
        // Check it is already slashed
        require(!proposal.slashed, "Already slashed");
        // Check the optimistic rollup exists
        require(proposal.headerHash != bytes32(0), "Does not exist");
    }

    function _forfeitAndReward(address proposerAddr, address challenger) internal {
        Proposer storage proposer = Layer2.chain.proposers[proposerAddr];
        // Reward
        uint256 challengeReward = proposer.stake * 2 / 3;
        payable(challenger).transfer(challengeReward);
        // Forfeit
        proposer.stake = 0;
        proposer.reward = 0;
        // Delete proposer
        delete Layer2.chain.proposers[proposerAddr];
    }

    function _execute(bytes32 proposalId, Challenge memory result) internal {
        require(result.slash, result.message);

        Proposal storage proposal = Layer2.chain.proposals[proposalId];
        // Check basic challenge conditions
        _checkChallengeCondition(proposal);
        // Since the challenge satisfies the given conditions, slash the optimistic rollup proposer
        proposal.slashed = true; // Record it as slashed;
        _forfeitAndReward(result.proposer, msg.sender);
        // TODO log message
    }
}
