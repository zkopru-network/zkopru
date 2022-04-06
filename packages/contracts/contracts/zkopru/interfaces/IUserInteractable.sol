// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.7.4;
pragma experimental ABIEncoderV2;

import { PublicData } from "../libraries/Types.sol";

struct PrepayRequest {
    address prepayer;
    bytes32 withdrawalHash;
    uint256 prepayFeeInEth;
    uint256 prepayFeeInToken;
    uint256 expiration;
}

interface IUserInteractable {
    event Deposit(uint256 indexed queuedAt, uint256 note, uint256 fee);
    event DepositUtxo(
        uint256 indexed spendingPubKey,
        uint256 salt,
        uint256 eth,
        address token,
        uint256 amount,
        uint256 nft,
        uint256 fee
    );

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
        uint256 callerFee,
        bytes32 blockHash,
        uint256 leafIndex,
        uint256[] calldata siblings
    ) external;

    function payInAdvance(
        uint256 note,
        PublicData memory publicData,
        PrepayRequest memory prepayRequest,
        bytes memory signature
    ) external payable;
}
