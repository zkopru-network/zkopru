// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.7.4;
pragma experimental ABIEncoderV2;

import {
    UserInteractable
} from "../../target/zkopru/controllers/UserInteractable.sol";

contract UserInteractableTester is UserInteractable {
    constructor() {}

    function registerERC20(address tokenAddr) public {
        chain.registeredERC20s[tokenAddr] = true;
    }

    function registerERC721(address tokenAddr) public {
        chain.registeredERC721s[tokenAddr] = true;
    }

    function mockWithdrawalRoot(bytes32 mockL2Block, uint256 withdrawalRoot)
        public
    {
        chain.finalized[mockL2Block] = true;
        chain.withdrawalRootOf[mockL2Block] = withdrawalRoot;
    }
}
