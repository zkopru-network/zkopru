// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

interface IConfigurable {
    event Update(string name, uint256 value);

    function setMaxBlockSize(uint256 blockSize) external;

    function setMaxValidationGas(uint256 maxGas) external;

    function setChallengePeriod(uint256 period) external;

    function setMinimumStake(uint256 stake) external;

    function setReferenceDepth(uint256 depth) external;

    function setConsensusProvider(address provider) external;
}