// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.7.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract TestERC721 is ERC721 {
    constructor() public ERC721("ZKOPRU721", "ZNFT") {
        for (uint256 i = 0; i < 10; i++) {
            _mint(msg.sender, i);
        }
    }
}
