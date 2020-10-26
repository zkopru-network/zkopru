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

    address registered;

    constructor(address payable networkAddress) public {
        zkopru = Zkopru(networkAddress);
    }

    function transfer(address recipient) public override {
      // TODO move burnt asset
    }

    function register() public override payable {
        require(msg.value >= zkopru.MINIMUM_STAKE(), "Should stake more than minimum amount of ETH");
        ICoordinatable(address(zkopru)).stake{ value: msg.value }(msg.sender);
        registered = msg.sender;
    }

    /**
     * @notice This function will be updated as the governance of Zkopru's been updated.
     */
    function isProposable(address proposer) public override view returns (bool) {
        return registered == proposer;
    }
}
