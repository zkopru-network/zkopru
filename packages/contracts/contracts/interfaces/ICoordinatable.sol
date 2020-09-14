// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

interface ICoordinatable {
    event NewProposal(uint256 proposalNum, bytes32 blockHash);
    event Finalized(bytes32 blockHash);
    event MassDepositCommit(uint256 index, bytes32 merged, uint256 fee);
    event NewErc20(address tokenAddr);
    event NewErc721(address tokenAddr);

    function register() external payable;

    function deregister() external;

    function propose(bytes calldata blockData) external;

    function finalize(bytes calldata finalization) external;

    function withdrawReward(uint256 amount) external;

    function commitMassDeposit() external;

    function registerERC20(address tokenAddr) external;

    function registerERC721(address tokenAddr) external;

    function isProposable(address proposerAddr) external view returns (bool);
}