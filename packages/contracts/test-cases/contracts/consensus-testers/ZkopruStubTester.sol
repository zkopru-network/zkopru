// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import { BurnAuction } from "../../../contracts/consensus/BurnAuction.sol";
import { IConsensusProvider } from "../../../contracts/consensus/interfaces/IConsensusProvider.sol";

contract ZkopruStubTester {
  address consensusProvider;

  mapping (address => uint) proposalBlock;

  function setConsensusProvider(address provider) public {
    consensusProvider = provider;
  }

  function propose(address coordinator) public  {
    require(consensusProvider != address(0), "Consensus provider not set");
    IConsensusProvider(consensusProvider).openRoundIfNeeded();
    require(IConsensusProvider(consensusProvider).isProposable(coordinator), "Not approved to propose block");
    proposalBlock[coordinator] = block.number;
  }

  function latestProposalBlock(address coordinator) public view returns (uint) {
    return proposalBlock[coordinator];
  }

  function stake(address coordinator) public payable {
    // stub
  }

  function lock(uint roundIndex) public {
    require(consensusProvider != address(0), "Consensus provider not set");
    IConsensusProvider(consensusProvider).lockForUpgrade(roundIndex);
  }
}
