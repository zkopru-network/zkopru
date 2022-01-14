// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.7.4;

import "../../target/consensus/BurnAuction.sol";

contract BurnAuctionTester is BurnAuction {
    constructor(address payable networkAddress)
        public
        BurnAuction(networkAddress)
    {}
}
