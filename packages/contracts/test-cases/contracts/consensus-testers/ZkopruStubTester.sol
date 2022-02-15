// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.7.4;

import { BurnAuction } from "../../target/consensus/BurnAuction.sol";
import {
    IConsensusProvider
} from "../../target/consensus/interfaces/IConsensusProvider.sol";

contract ZkopruStubTester {
    address public consensusProvider;

    mapping(address => uint256) proposalBlock;

    function setConsensusProvider(address provider) public {
        consensusProvider = provider;
    }

    function propose(address coordinator) public {
        require(consensusProvider != address(0), "Consensus provider not set");
        IConsensusProvider(consensusProvider).openRoundIfNeeded();
        require(
            IConsensusProvider(consensusProvider).isProposable(coordinator),
            "Not approved to propose block"
        );
        proposalBlock[coordinator] = block.number;
    }

    function latestProposalBlock(address coordinator)
        public
        view
        returns (uint256)
    {
        return proposalBlock[coordinator];
    }

    function stake(address coordinator) public payable {
        // stub
    }

    function lock(uint256 roundIndex) public {
        require(consensusProvider != address(0), "Consensus provider not set");
        IConsensusProvider(consensusProvider).lockForUpgrade(roundIndex);
    }
}
