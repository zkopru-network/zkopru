// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import { Storage } from "../../storage/Storage.sol";
import {
    Block,
    Transaction,
    MassDeposit,
    MassMigration,
    Types
} from "../../libraries/Types.sol";
import { Deserializer } from "../../libraries/Deserializer.sol";
import { IHeaderValidator } from "../../interfaces/validators/IHeaderValidator.sol";

contract HeaderValidator is Storage, IHeaderValidator {
    using Types for MassDeposit[];
    using Types for MassMigration[];
    using Types for Transaction[];

    /**
     * @dev Challenge when the submitted header's deposit root is invalid.
     * @param // blockData Serialized block data
     */
    function validateDepositRoot(bytes calldata)
    external
    pure
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        // code H1: Header has invalid deposit root
        return (_block.header.depositRoot != _block.body.massDeposits.root(), "H1");
    }

    /**
     * @dev Challenge when the submitted header's transfer root is invalid.
     *      The transfer root in the header should be the merkle root of the transfer
     *      tx hash values.
     * @param // blockData Serialized block data
     */
    function validateTxRoot(bytes calldata)
    external
    pure
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        // code H2: Header has invalid transaction root
        return (_block.header.txRoot != _block.body.txs.root(), "H2");
    }

    /**
     * @dev Challenge when the submitted header's migration root is invalid.
     *      The migration root in the header should be the merkle root of the migration
     *      tx hash values.
     * @param // blockData Serialized block data
     */
    function validateMigrationRoot(bytes calldata)
    external
    pure
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        // code H3: Header has invalid migration root
        return (_block.header.migrationRoot != _block.body.massMigrations.root(), "H3");
    }

    /**
     * @dev Challenge when the submitted header's total fee is not same with
     *      the sum of the fees in every transactions in the block.
     * @param // blockData Serialized block data
     */
    function validateTotalFee(bytes calldata)
    external
    pure
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        uint256 totalFee = 0;
        for (uint256 i = 0; i < _block.body.massDeposits.length; i ++) {
            totalFee += _block.body.massDeposits[i].fee;
        }
        for (uint256 i = 0; i < _block.body.txs.length; i ++) {
            totalFee += _block.body.txs[i].fee;
        }
        // FYI, fee in the massMigration is for the destination contract
        // code H4: Header has invalid total fee value
        return (totalFee != _block.header.fee, "H4");
    }

    /**
     * @dev Challenge when the submitted header's parent block is already slashed
     * @param // blockData Serialized block data
     */
    function validateParentBlock(bytes calldata)
    external
    view
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        // code H5: Parent block is a slasehd block.
        return (Storage.chain.slashed[_block.header.parentBlock], "H5");
    }
}
