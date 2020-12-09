// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import "../zkopru/Zkopru.sol";
import "../zkopru/interfaces/ICoordinatable.sol";
import "./interfaces/IConsensusProvider.sol";
import "./interfaces/IBurnAuction.sol";

/**
 * @dev [WIP] Sample contract to implement burn auction for coordination consensus.
 */
contract BurnAuction is IConsensusProvider, IBurnAuction {
    Zkopru zkopru;

    struct Bid {
        address payable owner;
        uint amount;
    }

    uint immutable startDate;
    // Round length in seconds
    uint constant roundLength = 10 minutes;
    // The start time of an auction, in seconds before the round
    uint constant auctionStartTime = 30 days;
    // Auction end time, in seconds before the round
    uint constant auctionEndTime = roundLength * 2;
    // Min bid is 10000 gwei
    uint constant minBid = 10000 gwei;

    // As a percentage (denominator)
    uint constant minBidIncrease = 10;

    // The current balance from success auctions
    uint public balance = 0;
    uint lastBalanceIndex = 0;

    bool _locked = false;

    // A round is considered open if a block has not been proposed in the first half of the round
    uint latestOpenRound = 0;

    // Ether to be refunded from being outbid
    mapping (address => uint) pendingBalances;
    mapping (uint => Bid) highestBidPerRound;

    event NewHighBid(uint roundIndex, address bidder, uint amount);

    constructor(address payable networkAddress) public {
        zkopru = Zkopru(networkAddress);
        startDate = block.timestamp;
    }

    function bid(uint roundIndex) public payable {
        require(!_locked, "BurnAuction: Contract is locked");
        uint roundStart = calcRoundStart(roundIndex);
        require(roundStart > block.timestamp, "BurnAuction: Round is in past");
        require(roundStart - block.timestamp > auctionEndTime, "BurnAuction: Bid is too close to round start");
        require(roundStart - block.timestamp < auctionStartTime, "BurnAuction: Bid is too far from round start");
        // bid timing is valid
        require(msg.value >= minNextBid(roundIndex), "BurnAuction: Bid not high enough");
        // bid amount is valid

        Bid memory prevHighBid = highestBidPerRound[roundIndex];
        if (prevHighBid.owner != address(0)) {
            // Refund the previous high bidder
            pendingBalances[prevHighBid.owner] += prevHighBid.amount;
        }
        highestBidPerRound[roundIndex] = Bid(msg.sender, msg.value);
        emit NewHighBid(roundIndex, msg.sender, msg.value);
    }

    // The minimum bid for a given round
    function minNextBid(uint roundIndex) public view returns (uint) {
        uint highestBid = max(highestBidPerRound[roundIndex].amount, minBid);
        return highestBid + (highestBid / minBidIncrease);
    }

    // The current owner for a round, this may change if the auction is open
    function coordinatorForRound(uint roundIndex) public view returns (address) {
        return highestBidPerRound[roundIndex].owner;
    }

    // Return the winning bidder for the current round
    function activeCoordinator() public view returns (address) {
        return coordinatorForRound(currentRound());
    }

    // Return the start time of a given round index
    function calcRoundStart(uint roundIndex) public view returns (uint) {
        return startDate + (roundIndex * roundLength);
    }

    // Returnt the current round number
    function currentRound() public view returns (uint) {
        return (block.timestamp - startDate) / roundLength;
    }

    // Refund non-winning bids
    function refund() public {
        refundAddress(msg.sender);
    }

    function refundAddress(address payable owner) public {
        require(pendingBalances[owner] > 0, "BurnAuction: No balance to refund");
        uint amountToRefund = pendingBalances[owner];
        pendingBalances[owner] = 0;
        owner.transfer(amountToRefund);
    }

    // Dumps the available balance to recipient
    // TODO: Split funds
    function transfer(address payable recipient) public override {
        updateBalance();
        uint withdrawAmount = balance;
        balance = 0;
        recipient.transfer(withdrawAmount);
    }

    // Update the contract available balance
    // I'm iffy on this gas management pattern
    function updateBalance() public {
        uint newBalance = balance;
        uint x = lastBalanceIndex;
        for (; x <= currentRound(); ++x) {
            if (highestBidPerRound[x].amount == 0) continue;
            newBalance += highestBidPerRound[x].amount;
            if (gasleft() < 3000) {
                break;
            }
        }
        balance = newBalance;
        lastBalanceIndex = x;
    }

    function register() public override payable {
        ICoordinatable(address(zkopru)).stake{ value: msg.value }(msg.sender);
    }

    function openRoundIfNeeded() public override {
        if (latestOpenRound == currentRound()) return;
        if (shouldOpenRound()) {
            latestOpenRound = currentRound();
        }
    }

    // Determines if the current round should be opened for anyone to propose blocks
    function shouldOpenRound() public view returns (bool) {
        uint currentRoundStart = calcRoundStart(currentRound());
        if (block.timestamp > currentRoundStart + roundLength / 2) {
            // If more than midway through the round determine if a block has
            // been proposed. If not, open the round for anyone to propose blocks
            uint latestProposalBlock =
              ICoordinatable(address(zkopru)).coordinatorExitBlock(activeCoordinator()) - zkopru.CHALLENGE_PERIOD();
            // approx block start
            uint roundStartBlock = block.number - ((block.timestamp - currentRoundStart) / 15);
            return latestProposalBlock < roundStartBlock;
        }
        return false;
    }

    /**
     * @notice This function will be updated as the governance of Zkopru's been updated.
     */
    function isProposable(address proposer) public view override returns (bool) {
        return
          latestOpenRound == currentRound() ||
          activeCoordinator() == address(0) ||
          activeCoordinator() == proposer ||
          shouldOpenRound(); // Call this in case a client makes a query to determine if they should attempt to propose a block
    }

    // Only zkopru may call
    function lockForUpgrade(uint roundIndex) public {
        require(msg.sender == address(zkopru), "BurnAuction: Not authorized to initiate lock");
        uint roundStart = calcRoundStart(roundIndex);
        require(block.timestamp < roundStart - auctionStartTime, "BurnAuction: Round index is not far enough in the future");
        _locked = true;
    }

    function max(uint a, uint b) public pure returns (uint) {
        return a > b ? a : b;
    }
}
