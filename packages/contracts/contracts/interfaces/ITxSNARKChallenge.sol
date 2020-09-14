// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;
pragma experimental ABIEncoderV2;

import { Transaction } from "../libraries/Types.sol";

interface ITxSNARKChallenge {
    /**
     * @dev Challenge when the submitted transaction has an invalid SNARK proof
     * @param txIndex Index of the transaction in the tx list of the block body.
     * @param blockData Serialized block data
     */
    function challengeSNARK(uint256 txIndex, bytes calldata blockData) external;

    /**
     * @dev This function Is also called for the try/catch statement in challengeSNARK() function.
     */
    function hasValidSNARK(Transaction memory transaction) external view returns (bool result, string memory reason);
}