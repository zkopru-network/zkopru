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
        uint232 amount;
    }

    // Round length in blocks
    uint8 constant blockTime = 15;
    // As a percentage (denominator)
    uint8 constant minBidIncrease = 10;

    uint56 immutable public startBlock;
    // Just to make math more clear
    uint56 constant public roundLength = (10 minutes / blockTime);
    // The start time of an auction, in blocks before the round
    uint56 constant public auctionStart = (30 days / blockTime);
    // Auction end time, in blocks before the round
    uint56 constant public auctionEnd = roundLength * 2;
    // Min bid is 10000 gwei
    uint constant minBid = 10000 gwei;


    // The current balance from success auctions
    uint public balance = 0;
    uint public lastBalanceIndex = 0;

    uint public lockedRoundIndex = type(uint).max;

    // A round is considered open if a block has not been proposed in the first half of the round
    uint latestOpenRound = 0;

    // Ether to be refunded from being outbid
    mapping (address => uint) public pendingBalances;
    mapping (uint => Bid) public highestBidPerRound;
    mapping (address => string) public override coordinatorUrls;

    event UrlUpdate(address coordinator);
    event NewHighBid(uint roundIndex, address bidder, uint amount);

    constructor(address payable networkAddress) public {
        zkopru = Zkopru(networkAddress);
        startBlock = uint56(block.number);
    }

    function bid(uint roundIndex) public override payable {
        pendingBalances[msg.sender] += msg.value;
        bid(roundIndex, msg.value);
    }

    function bid(uint roundIndex, uint amount) public override {
        require(roundIndex < lockedRoundIndex, "BurnAuction: Contract is locked");
        require(bytes(coordinatorUrls[msg.sender]).length != 0, "BurnAuction: Coordinator url not set");
        uint roundStart = calcRoundStart(roundIndex);
        require(block.number < roundStart, "BurnAuction: Round is in past");
        require(block.number < guardedSub(roundStart, auctionEnd), "BurnAuction: Bid is too close to round start");
        require(block.number > guardedSub(roundStart, auctionStart), "BurnAuction: Bid is too far from round start");
        // bid timing is valid
        require(amount <= pendingBalances[msg.sender], "BurnAuction: Insufficient funds");
        require(amount >= minNextBid(roundIndex), "BurnAuction: Bid not high enough");
        // bid amount is valid

        // check for overflow
        require(amount <= type(uint232).max, "BurnAuction: Bid amount too high");
        Bid memory prevHighBid = highestBidPerRound[roundIndex];
        if (prevHighBid.owner != address(0)) {
            // Refund the previous high bidder
            pendingBalances[prevHighBid.owner] += prevHighBid.amount;
        }
        highestBidPerRound[roundIndex] = Bid(msg.sender, uint232(amount));
        pendingBalances[msg.sender] -= amount;
        emit NewHighBid(roundIndex, msg.sender, amount);
    }

    function multiBid(uint _minBid, uint maxBid, uint startRound, uint endRound) public override payable {
        pendingBalances[msg.sender] += msg.value;
        for (uint x = startRound; x <= endRound; x++) {
            uint nextBid = minNextBid(x);
            if (nextBid > maxBid) continue;
            if (highestBidPerRound[x].owner == msg.sender) continue; // don't bid over self
            uint bidAmount = max(_minBid, nextBid);
            if (bidAmount > pendingBalances[msg.sender]) break;
            bid(x, bidAmount);
        }
    }

    function setUrl(string memory url) public override {
        coordinatorUrls[msg.sender] = url;
        emit UrlUpdate(msg.sender);
    }

    function clearUrl() public override {
        delete coordinatorUrls[msg.sender];
        emit UrlUpdate(msg.sender);
    }

    function earliestBiddableRound() public view returns (uint) {
      return roundForBlock(calcRoundStart(currentRound()) + roundLength + auctionEnd);
    }

    function latestBiddableRound() public view returns (uint) {
      return roundForBlock(calcRoundStart(currentRound()) + auctionStart);
    }

    // The minimum bid for a given round
    function minNextBid(uint roundIndex) public view override returns (uint) {
        uint highestBid = max(highestBidPerRound[roundIndex].amount, minBid);
        return highestBid + (highestBid / minBidIncrease);
    }

    // The current owner for a round, this may change if the auction is open
    function coordinatorForRound(uint roundIndex) public view override returns (address) {
        return highestBidPerRound[roundIndex].owner;
    }

    // Return the winning bidder for the current round
    function activeCoordinator() public view override returns (address) {
        return coordinatorForRound(currentRound());
    }

    // Return the start block of a given round index
    function calcRoundStart(uint roundIndex) public view override returns (uint) {
        return startBlock + (roundIndex * roundLength);
    }

    function roundForBlock(uint blockNumber) public view returns (uint) {
        return (blockNumber - startBlock) / roundLength;
    }

    // Returnt the current round number
    function currentRound() public view override returns (uint) {
        return roundForBlock(block.number);
    }

    // Refund non-winning bids
    function refund() public {
        refund(msg.sender);
    }

    function refund(address payable owner) public {
        uint amountToRefund = pendingBalances[owner];
        if (amountToRefund == 0) return;
        pendingBalances[owner] = 0;
        owner.transfer(amountToRefund);
    }

    // Dumps the available balance to recipient
    // TODO: Split funds
    function transferBalance(address payable recipient) public override {
        updateBalance();
        uint withdrawAmount = balance;
        balance = 0;
        recipient.transfer(withdrawAmount);
    }

    // Update the contract available balance
    function updateBalance() public {
        updateBalance(currentRound() - lastBalanceIndex);
    }

    function updateBalance(uint maxIterations) public {
        if (lastBalanceIndex == currentRound()) return;
        uint newBalance = balance;
        uint x = lastBalanceIndex + 1;
        uint finalIndex = min(x + maxIterations, currentRound());
        for (; x <= finalIndex; x++) {
            if (highestBidPerRound[x].amount == 0) continue;
            newBalance += highestBidPerRound[x].amount;
        }
        balance = newBalance;
        lastBalanceIndex = finalIndex;
    }

    function register() public override payable {
        ICoordinatable(address(zkopru)).stake{ value: msg.value }(msg.sender);
    }

    function openRoundIfNeeded() public override {
        if (isRoundOpen()) return;
        if (shouldOpenRound()) {
            latestOpenRound = currentRound();
        }
    }

    // Determines if the current round should be opened for anyone to propose blocks
    function shouldOpenRound() public view override returns (bool) {
        uint currentRoundStart = calcRoundStart(currentRound());
        if (block.number < currentRoundStart + roundLength / 2) {
            return false;
        }
        // If more than midway through the round determine if a block has
        // been proposed. If not, open the round for anyone to propose blocks
        uint latestProposalBlock = zkopru.latestProposalBlock(activeCoordinator());
        return latestProposalBlock < currentRoundStart;
    }

    function isRoundOpen() public view override returns (bool) {
        return latestOpenRound == currentRound();
    }

    /**
     * @notice This function will be updated as the governance of Zkopru's been updated.
     */
    function isProposable(address proposer) public view override returns (bool) {
        if (currentRound() >= lockedRoundIndex) return false;
        return
          isRoundOpen() ||
          activeCoordinator() == address(0) ||
          activeCoordinator() == proposer ||
          shouldOpenRound(); // Call this in case a client makes a query to determine if they should attempt to propose a block
    }

    // Only zkopru may call
    function lockForUpgrade(uint roundIndex) public override {
        require(lockedRoundIndex == type(uint).max, "BurnAuction: Contract already locked");
        require(msg.sender == address(zkopru), "BurnAuction: Not authorized to initiate lock");
        uint roundStart = calcRoundStart(roundIndex);
        require(block.number < guardedSub(roundStart, auctionStart), "BurnAuction: Round index is not far enough in the future");
        lockedRoundIndex = roundIndex;
    }

    function min(uint a, uint b) internal pure returns (uint) {
        return a > b ? b : a;
    }

    function max(uint a, uint b) internal pure returns (uint) {
        return a > b ? a : b;
    }

    function guardedSub(uint a, uint b) internal pure returns (uint) {
        if (b > a) return 0;
        return a - b;
    }
}
