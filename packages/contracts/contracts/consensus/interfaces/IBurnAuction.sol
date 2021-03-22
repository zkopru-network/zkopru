// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.7.4;

interface IBurnAuction {
    event UrlUpdate(address coordinator);
    event NewHighBid(uint256 roundIndex, address bidder, uint256 amount);

    function startBlock() external view returns (uint32);

    function roundLength() external pure returns (uint32);

    function minBid() external pure returns (uint112);

    function highestBidForRound(uint256 roundIndex)
        external
        view
        returns (uint232, address);

    function transferBalance(address payable recipient) external;

    function register() external payable;

    function setUrl(string memory url) external;

    function clearUrl() external;

    function earliestBiddableRound() external view returns (uint256);

    function latestBiddableRound() external view returns (uint256);

    function coordinatorUrls(address url) external view returns (string memory);

    function bid(uint256 roundIndex) external payable;

    function bid(uint256 roundIndex, uint256 amount) external;

    function multiBid(
        uint256 _minBid,
        uint256 maxBid,
        uint256 startRound,
        uint256 endRound
    ) external payable;

    function minNextBid(uint256 roundIndex) external view returns (uint256);

    function calcRoundStart(uint256 roundIndex) external view returns (uint256);

    function coordinatorForRound(uint256 roundIndex)
        external
        view
        returns (address);

    function activeCoordinator() external view returns (address);

    function currentRound() external view returns (uint256);

    function shouldOpenRound() external view returns (bool);

    function isRoundOpen() external view returns (bool);

    function pendingBalances(address owner) external view returns (uint256);

    function refund() external;

    function refund(address payable owner) external;
}
