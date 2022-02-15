// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.7.4;
pragma experimental ABIEncoderV2;

import {
    Proof,
    Outflow,
    Block,
    Transaction,
    Types
} from "../../target/zkopru/libraries/Types.sol";
import { Deserializer } from "../../target/zkopru/libraries/Deserializer.sol";
import {
    UtxoTreeValidator
} from "../../target/zkopru/controllers/validators/UtxoTreeValidator.sol";

contract UtxoTreeValidatorTester is UtxoTreeValidator {
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
}
