// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import { Storage } from "../storage/Storage.sol";
import { Deserializer } from "../libraries/Deserializer.sol";
import {
    Proposer,
    Proposal
} from "../libraries/Types.sol";

contract Configurable is Storage {
    event Update(string name, uint256 value);

    function setMaxBlockSize(uint256 blockSize) public onlyOwner {
        MAX_BLOCK_SIZE = blockSize;
        emit Update("MAX_BLOCK_SIZE", blockSize);
    }

    function setMaxValidationGas(uint256 maxGas) public onlyOwner {
        MAX_VALIDATION_GAS = maxGas;
        emit Update("MAX_VALIDATION_GAS", maxGas);
    }

    function setChallengePeriod(uint256 period) public onlyOwner {
        CHALLENGE_PERIOD = period;
        emit Update("CHALLENGE_PERIOD", period);
    }

    function setMinimumStake(uint256 stake) public onlyOwner {
        MINIMUM_STAKE = stake;
        emit Update("MINIMUM_STAKE", stake);
    }

    function setReferenceDepth(uint256 depth) public onlyOwner {
        REF_DEPTH = depth;
        emit Update("REF_DEPTH", depth);
    }

    function setConsensusProvider(address provider) public onlyOwner {
        consensusProvider = provider;
        emit Update("consensusProvider", uint256(provider));
    }
}
