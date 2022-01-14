// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.7.4;

import {
    Coordinatable
} from "../../target/zkopru/controllers/Coordinatable.sol";

import {
    IConsensusProvider
} from "../../target/consensus/interfaces/IConsensusProvider.sol";
import { Proposer, Proposal } from "../../target/zkopru/libraries/Types.sol";

contract MockConsensusProvider is IConsensusProvider {
    function openRoundIfNeeded() external override {}

    function lockForUpgrade(uint256 roundIndex) external override {}

    function isProposable(address proposerAddr)
        public
        view
        override
        returns (bool)
    {
        // just return true
        return proposerAddr != address(this);
    }
}

contract CoordinatableTester is Coordinatable {
    constructor() {
        MockConsensusProvider mock = new MockConsensusProvider();
        consensusProvider = address(mock);
    }

    function mockFinalization(
        bytes32 checksum,
        bytes32 headerHash,
        bytes32 parentBlock
    ) public {
        Proposal storage proposal = chain.proposals[checksum];
        proposal.headerHash = headerHash;
        proposal.challengeDue = block.number - 1;
        chain.latest = parentBlock;
    }
}
