// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import { MassDeposit, WithdrawalTree, Types } from "../libraries/Types.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

struct Asset {
    address erc20;
    address wallet;
}

library AssetHandler {
    /**
     * @dev It moves assets from layer 1 to the layer 2 anchor contract.
     */
    function depositFrom(Asset memory self, address from, uint256 amount) internal returns (bool) {
        if (self.erc20 == address(0)) {
            // Asset is Ether
            require(amount == msg.value, "Does not receive correct amount");
            require(from == msg.sender, "Different sender");
        } else {
            // Asset is ERC20
            IERC20(self.erc20).transferFrom(from, self.wallet, amount);
        }
        return true;
    }

    /**
     * @dev It withdraw assets back to the layer 1 from the layer 2 anchor contract.
     */
    function withdrawTo(Asset memory self, address to, uint256 amount) internal {
        if (self.erc20 == address(0)) {
            // Asset is Ether
            payable(to).transfer(amount);
        } else {
            // Asset is ERC20
            IERC20(self.erc20).transfer(to, amount);
        }
    }
}
