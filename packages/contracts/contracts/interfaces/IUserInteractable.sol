// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

interface IUserInteractable {
    event Deposit(uint256 indexed queuedAt, uint256 note, uint256 fee);

    function deposit(
        uint256 spendingPubKey,
        uint256 salt,
        uint256 eth,
        address token,
        uint256 amount,
        uint256 nft,
        uint256 fee
    ) external payable;

    function withdraw(
        uint256 note,
        address owner,
        uint256 eth,
        address token,
        uint256 amount,
        uint256 nft,
        uint256 fee,
        bytes32 blockHash,
        uint256 leafIndex,
        uint256[] calldata siblings
    ) external;

    function payInAdvance(
        uint256 note,
        address owner,
        uint256 eth,
        address token,
        uint256 amount,
        uint256 nft,
        uint256 fee,
        bytes calldata signature
    ) external;
}