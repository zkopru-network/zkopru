// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.7.4;
pragma experimental ABIEncoderV2;

import { Proof, Outflow, Block, Transaction, Types } from "../../../contracts/zkopru/libraries/Types.sol";
import { Deserializer } from "../../../contracts/zkopru/libraries/Deserializer.sol";

contract UtxoTreeValidatorTester {
    using Types for Outflow;

    function getUTXosFromBlock(bytes calldata, uint256[] memory deposits)
        public
        pure
        returns (uint256[] memory)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        uint256[] memory utxos = _getUTXOs(deposits, _block.body.txs);
        return utxos;
    }

    function _getUTXOs(uint256[] memory deposits, Transaction[] memory txs)
        private
        pure
        returns (uint256[] memory utxos)
    {
        // Calculate the length of the utxo array
        uint256 numOfUTXOs = deposits.length;
        for (uint256 i = 0; i < txs.length; i++) {
            Transaction memory transaction = txs[i];
            for (uint256 j = 0; j < transaction.outflow.length; j++) {
                if (transaction.outflow[j].isUTXO()) {
                    numOfUTXOs++;
                }
            }
        }
        // Make the utxo array
        utxos = new uint256[](numOfUTXOs);
        uint256 index = 0;
        // Append deposits first
        for (uint256 i = 0; i < deposits.length; i++) {
            utxos[index++] = deposits[i];
        }
        // Append UTXOs from transactions
        for (uint256 i = 0; i < txs.length; i++) {
            Transaction memory transaction = txs[i];
            for (uint256 j = 0; j < transaction.outflow.length; j++) {
                if (transaction.outflow[j].isUTXO()) {
                    utxos[index++] = transaction.outflow[j].note;
                }
            }
        }
    }
}
