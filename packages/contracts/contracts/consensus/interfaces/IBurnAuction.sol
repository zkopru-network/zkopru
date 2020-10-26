// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

interface IBurnAuction {
  function transfer(address recipient) external;

  function register() external payable; 
}
