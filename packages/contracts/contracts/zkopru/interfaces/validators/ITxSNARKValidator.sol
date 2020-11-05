// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;
pragma experimental ABIEncoderV2;

import { Transaction } from "../../libraries/Types.sol";

interface ITxSNARKValidator {
    /**
     * @dev Challenge when the submitted transaction has an invalid SNARK proof
     * @param blockData Serialized block data
     * @param txIndex Index of the transaction in the tx list of the block body.
     */
    function validateSNARK(bytes calldata blockData, uint256 txIndex)
    external
    view
    returns (bool slash, string memory reason);
}