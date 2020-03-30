pragma solidity >= 0.6.0;

interface IERC721 {
    function transferFrom(address from, address to, uint256 tokenId) external;
}