pragma solidity >= 0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestERC20 is ERC20 {
  constructor() ERC20('ZKOPRU20', 'ZRC') public {
    _mint(msg.sender, 10000000000 ether);
  }
}