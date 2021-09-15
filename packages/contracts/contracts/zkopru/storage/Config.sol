// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.7.4;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Config is Ownable {
    uint256 public constant UTXO_TREE_DEPTH = 48;
    uint256 public constant MAX_UTXO = (1 << UTXO_TREE_DEPTH);
    uint256 public constant WITHDRAWAL_TREE_DEPTH = 48;
    uint256 public constant MAX_WITHDRAWAL = (1 << WITHDRAWAL_TREE_DEPTH);
    uint256 public constant NULLIFIER_TREE_DEPTH = 254;

    uint256 public constant UTXO_SUB_TREE_DEPTH = 5; // 32 items at once
    uint256 public constant UTXO_SUB_TREE_SIZE = 1 << UTXO_SUB_TREE_DEPTH;
    uint256 public constant WITHDRAWAL_SUB_TREE_DEPTH = 5; // 32 items at once
    uint256 public constant WITHDRAWAL_SUB_TREE_SIZE =
        1 << WITHDRAWAL_SUB_TREE_DEPTH;

    uint256 public MAX_BLOCK_SIZE = 200000; // 3.2M gas for calldata
    uint256 public MAX_VALIDATION_GAS = 9000000; // 9M gas
    // 46523 blocks when the challenge period is 7 days and average block time is 13 sec
    uint256 public CHALLENGE_PERIOD = 46523;
    uint256 public MINIMUM_STAKE = 32 ether;
    uint256 public REF_DEPTH = 128;

    address public consensusProvider;
}
