// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

interface IBurnAuction {
    event UrlUpdate(address coordinator);
    event NewHighBid(uint roundIndex, address bidder, uint amount);
    function startBlock() external view returns (uint32);
    function roundLength() external view returns (uint32);
    function highestBidForRound(uint roundIndex) external view returns (uint232, address);
    function transferBalance(address payable recipient) external;
    function register() external payable;
    function setUrl(string memory url) external;
    function clearUrl() external;
    function earliestBiddableRound() external view returns (uint);
    function latestBiddableRound() external view returns (uint);
    function coordinatorUrls(address url) external view returns (string memory);
    function bid(uint roundIndex) external payable;
    function bid(uint roundIndex, uint amount) external;
    function multiBid(uint _minBid, uint maxBid, uint startRound, uint endRound) external payable;
    function minNextBid(uint roundIndex) external view returns (uint);
    function calcRoundStart(uint roundIndex) external view returns (uint);
    function coordinatorForRound(uint roundIndex) external view returns (address);
    function activeCoordinator() external view returns (address);
    function currentRound() external view returns (uint);
    function shouldOpenRound() external view returns (bool);
    function isRoundOpen() external view returns (bool);
    function pendingBalances(address owner) external view returns (uint);
}
