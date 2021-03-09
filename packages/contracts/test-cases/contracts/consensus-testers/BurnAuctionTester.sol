// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.7.4;

import "../../../contracts/consensus/BurnAuction.sol";

contract BurnAuctionTester is BurnAuction {
    constructor(address payable networkAddress) BurnAuction(networkAddress) public {
    }
}
