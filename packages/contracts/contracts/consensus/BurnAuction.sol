// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import "../zkopru/Zkopru.sol";
import "../zkopru/interfaces/ICoordinatable.sol";
import "./interfaces/IConsensusProvider.sol";
import "./interfaces/IBurnAuction.sol";

/**
 * @dev Burn auction for coordination consensus.
 */
contract BurnAuction is IConsensusProvider, IBurnAuction {
    Zkopru public zkopru;

    struct Bid {
        address payable owner;
        uint232 amount;
    }

    // Round length in blocks
    uint8 constant blockTime = 15;

    uint32 override immutable public startBlock;
    // Just to make math more clear
    uint32 constant public override roundLength = (10 minutes / blockTime);
    // The start time of an auction, in blocks before the round
    uint32 constant public auctionStart = (30 days / blockTime);
    // Auction end time, in blocks before the round
    uint32 constant public auctionEnd = roundLength * 2;
    // Min bid is 10000 gwei
    uint112 constant minBid = 10000 gwei;

    // The current balance from success auctions
    uint public balance = 0;
    // uint64 supports 350965450913242 years of operation with 10 minute rounds
    uint64 public lastBalanceIndex = 0;

    uint64 public lockedRoundIndex = type(uint64).max;

    // A round is considered open if a block has not been proposed in the first half of the round
    uint64 latestOpenRound = 0;

    // Ether to be refunded from being outbid
    mapping (address => uint) public override pendingBalances;
    mapping (uint => Bid) public highestBidPerRound;
    mapping (address => string) public override coordinatorUrls;


    event UrlUpdate(address coordinator);
    event NewHighBid(uint roundIndex, address bidder, uint amount);

    constructor(address payable networkAddress) public {
        zkopru = Zkopru(networkAddress);
        startBlock = uint32(block.number);
    }

    /**
     * @dev Shortcut for msg.sender to bid on an auction using msg.value amount.
     * @param roundIndex The round to bid on.
     **/
    function bid(uint roundIndex) public override payable {
        pendingBalances[msg.sender] += msg.value;
        bid(roundIndex, msg.value);
    }

    /**
     * @dev Bid on an auction.
     * @param roundIndex The auction round to bid on.
     * @param amount The amount of wei to bid on the round.
     **/
    function bid(uint roundIndex, uint amount) public override {
        require(zkopru.consensusProvider() == address(this), "BurnAuction: Not consensus provider");
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

    /**
     * @dev Bid on many rounds at once.
     * @param _minBid The minimum bid amount per round.
     * @param maxBid The maximum bid amount per round.
     * @param startRound The round to start bidding.
     * @param endRound The first round to bid on.
     **/
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

    /**
     * @dev Return the highest bid for a given round.
     * @param roundIndex The round to query.
     **/
    function highestBidForRound(uint roundIndex) public view override returns (uint232, address) {
        return (
          uint232(max(highestBidPerRound[roundIndex].amount, minBid)),
          highestBidPerRound[roundIndex].owner
        );
    }

    /**
     * @dev Set the public url for a coordinator node.
     * @param url The IP or DNS based url with port, without protocol. ex: 127.0.0.1:8888
     **/
    function setUrl(string memory url) public override {
        coordinatorUrls[msg.sender] = url;
        emit UrlUpdate(msg.sender);
    }

    /**
     * @dev Remove a url for a coordinator.
     **/
    function clearUrl() public override {
        delete coordinatorUrls[msg.sender];
        emit UrlUpdate(msg.sender);
    }

    /**
     * @dev Return the closest round that can be bid on.
     **/
    function earliestBiddableRound() public view override returns (uint) {
        return roundForBlock(calcRoundStart(currentRound()) + roundLength + auctionEnd);
    }

    /**
     * @dev Return the furthest round that can be bid on.
     **/
    function latestBiddableRound() public view override returns (uint) {
        return roundForBlock(calcRoundStart(currentRound()) + auctionStart);
    }

    /**
     * @dev The minimum bid for a given round.
     **/
    function minNextBid(uint roundIndex) public view override returns (uint) {
        return max(highestBidPerRound[roundIndex].amount, minBid) + 1;
    }

    /**
     * @dev Return the address of the current high bidder for a given round. Returns 0x0 for rounds without an owner.
     * @param roundIndex The round index to query.
     **/
    function coordinatorForRound(uint roundIndex) public view override returns (address) {
        return highestBidPerRound[roundIndex].owner;
    }

    /**
     * @dev Return the current round owner.
     **/
    function activeCoordinator() public view override returns (address) {
        return coordinatorForRound(currentRound());
    }

    /**
     * @dev Return the start block of a given round.
     * @param roundIndex The round index to query.
     **/
    function calcRoundStart(uint roundIndex) public view override returns (uint) {
        return startBlock + (roundIndex * roundLength);
    }

    /**
     * @dev Return the round index that a given block belongs to.
     * @param blockNumber The block to to query.
     **/
    function roundForBlock(uint blockNumber) public view returns (uint) {
        require(blockNumber >= startBlock, "Invalid block number");
        return (blockNumber - startBlock) / roundLength;
    }

    /**
     * @dev Return the current round number.
     **/
    function currentRound() public view override returns (uint) {
        return roundForBlock(block.number);
    }

    /**
     * @dev Refund shortcut for msg.sender.
     **/
    function refund() public override {
        refund(msg.sender);
    }

    /**
     * @dev Refund outstanding balances from non-winning bids. This is called the pending balance above.
     * @param owner The address to refund.
     **/
    function refund(address payable owner) public override {
        uint amountToRefund = pendingBalances[owner];
        if (amountToRefund == 0) return;
        pendingBalances[owner] = 0;
        owner.transfer(amountToRefund);
    }

    /**
     * @dev Send the available contract balance to a recipient.
     * @param recipient The receiving address for the funds.
     **/
    function transferBalance(address payable recipient) public override {
        updateBalance();
        uint withdrawAmount = balance;
        balance = 0;
        recipient.transfer(withdrawAmount);
    }

    /**
     * @dev Update the contract available balance based on the current round.
     **/
    function updateBalance() public {
        updateBalance(currentRound() - lastBalanceIndex);
    }

    /**
     * @dev Update the contract available balance based on winning bids.
     * @param maxIterations The maximum number of rounds to consider (to prevent out of gas issues).
     **/
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
        lastBalanceIndex = uint64(finalIndex);
    }

    /**
     * @dev Register as a coordinator.
     **/
    function register() public override payable {
        require(zkopru.consensusProvider() == address(this), "BurnAuction: Not consensus provider");
        ICoordinatable(address(zkopru)).stake{ value: msg.value }(msg.sender);
    }

    /**
     * @dev Open a round for anyone to propose blocks if needed.
     **/
    function openRoundIfNeeded() public override {
        if (isRoundOpen()) return;
        if (shouldOpenRound()) {
            latestOpenRound = uint64(currentRound());
        }
    }

    /**
     * @dev Determine if a certain round should be opened to anyone. This happens if there is no bidder, or if no blocks are proposed in the first half of the round.
     **/
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

    /**
     * @dev Lock the contract to prevent future bids.
     **/
    function lockForUpgrade(uint roundIndex) public override {
        require(roundIndex < type(uint64).max, "BurnAuction: Invalid round index for locking");
        require(lockedRoundIndex == type(uint64).max, "BurnAuction: Contract already locked");
        require(msg.sender == address(zkopru), "BurnAuction: Not authorized to initiate lock");
        uint roundStart = calcRoundStart(roundIndex);
        require(block.number < guardedSub(roundStart, auctionStart), "BurnAuction: Round index is not far enough in the future");
        lockedRoundIndex = uint64(roundIndex);
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
