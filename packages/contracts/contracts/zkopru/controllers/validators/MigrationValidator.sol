// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.7.4;

import { Storage } from "../../storage/Storage.sol";
import {
    Block,
    Transaction,
    Outflow,
    MassDeposit,
    MassMigration,
    OutflowType,
    Types
} from "../../libraries/Types.sol";
import { Deserializer } from "../../libraries/Deserializer.sol";
import {
    IMigrationValidator
} from "../../interfaces/validators/IMigrationValidator.sol";

contract MigrationValidator is Storage, IMigrationValidator {
    using Types for Outflow;
    using Types for MassMigration;

    /**
     * @param // blockData Serialized block data
     * @param massMigrationIdx1 mass migration index in the block body
     * @param massMigrationIdx2 mass migration index in the block body that has same destination and token address
            with the first mass migration
     */
    function validateDuplicatedMigrations(
        bytes calldata,
        uint256 massMigrationIdx1,
        uint256 massMigrationIdx2
    ) external pure override returns (bool slash, string memory reason) {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        require(
            massMigrationIdx1 < _block.body.massMigrations.length,
            "out of index"
        );
        require(
            massMigrationIdx2 < _block.body.massMigrations.length,
            "out of index"
        );
        MassMigration memory m1 = _block.body.massMigrations[massMigrationIdx1];
        MassMigration memory m2 = _block.body.massMigrations[massMigrationIdx2];
        // code M1: Duplicated MassMigration ids exist
        return (m1.getMigrationId() == m2.getMigrationId(), "M1");
    }

    /**
     * @param // blockData Serialized block data
     * @param migrationIndex Index of the mass migration to challenge
     */
    function validateEthMigration(bytes calldata, uint256 migrationIndex)
        external
        pure
        override
        returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        require(
            migrationIndex < _block.body.massMigrations.length,
            "out of index"
        );
        MassMigration memory migration =
            _block.body.massMigrations[migrationIndex];
        bytes32 migrationId = migration.getMigrationId();

        uint256 eth;
        for (uint256 i = 0; i < _block.body.txs.length; i++) {
            Transaction memory transaction = _block.body.txs[i];
            for (uint256 j = 0; j < transaction.outflow.length; j++) {
                Outflow memory outflow = transaction.outflow[j];
                if (outflow.getMigrationId() == migrationId) {
                    eth += outflow.publicData.eth;
                }
            }
        }
        // code M2: MassMigration is carrying invalid amount of ETH
        return (eth != migration.asset.eth, "M2");
    }

    /**
     * @param // blockData Serialized block data
     * @param migrationIndex Index of the mass migration to challenge
     */
    function validateERC20Migration(bytes calldata, uint256 migrationIndex)
        external
        pure
        override
        returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        require(
            migrationIndex < _block.body.massMigrations.length,
            "out of index"
        );
        MassMigration memory migration =
            _block.body.massMigrations[migrationIndex];
        bytes32 migrationId = migration.getMigrationId();

        uint256 amount;
        for (uint256 i = 0; i < _block.body.txs.length; i++) {
            Transaction memory transaction = _block.body.txs[i];
            for (uint256 j = 0; j < transaction.outflow.length; j++) {
                Outflow memory outflow = transaction.outflow[j];
                if (outflow.getMigrationId() == migrationId) {
                    amount += outflow.publicData.amount;
                }
            }
        }
        // code M3: MassMigration is carrying invalid amount of token
        return (amount != migration.asset.amount, "M3");
    }

    /**
     * @param // blockData Serialized block data
     * @param migrationIndex Index of the mass migration to challenge
     */
    function validateMergedLeaves(bytes calldata, uint256 migrationIndex)
        external
        pure
        override
        returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        require(
            migrationIndex < _block.body.massMigrations.length,
            "out of index"
        );
        MassMigration memory migration =
            _block.body.massMigrations[migrationIndex];
        bytes32 migrationId = migration.getMigrationId();

        MassDeposit memory depositForDest;
        for (uint256 i = 0; i < _block.body.txs.length; i++) {
            Transaction memory transaction = _block.body.txs[i];
            for (uint256 j = 0; j < transaction.outflow.length; j++) {
                Outflow memory outflow = transaction.outflow[j];
                if (outflow.getMigrationId() == migrationId) {
                    depositForDest.merged = keccak256(
                        abi.encodePacked(depositForDest.merged, outflow.note)
                    );
                }
            }
        }
        // code M4: MassMigration is carrying invalid merged leaves value
        return (depositForDest.merged != migration.depositForDest.merged, "M4");
    }

    /**
     * @param // blockData Serialized block data
     * @param migrationIndex Index of the mass migration to challenge
     */
    function validateMigrationFee(bytes calldata, uint256 migrationIndex)
        external
        pure
        override
        returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        require(
            migrationIndex < _block.body.massMigrations.length,
            "out of index"
        );
        MassMigration memory migration =
            _block.body.massMigrations[migrationIndex];
        bytes32 migrationId = migration.getMigrationId();

        MassDeposit memory depositForDest;
        for (uint256 i = 0; i < _block.body.txs.length; i++) {
            Transaction memory transaction = _block.body.txs[i];
            for (uint256 j = 0; j < transaction.outflow.length; j++) {
                Outflow memory outflow = transaction.outflow[j];
                if (outflow.getMigrationId() == migrationId) {
                    depositForDest.fee += outflow.publicData.fee;
                }
            }
        }
        // code M5: Aggregated migration fee is not correct
        return (depositForDest.fee != migration.depositForDest.fee, "M5");
    }

    function validateTokenRegistration(bytes calldata, uint256 migrationIndex)
        external
        view
        override
        returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        require(
            migrationIndex < _block.body.massMigrations.length,
            "out of index"
        );
        MassMigration memory migration =
            _block.body.massMigrations[migrationIndex];

        address token = migration.asset.token;
        require(token != address(0), "Not a token migration");
        // code M6: Only registered ERC20 tokens are supported for mass migration.
        return (!Storage.chain.registeredERC20s[token], "M6");
    }

    function validateMissedMassMigration(
        bytes calldata,
        uint256 txIndex,
        uint256 outflowIndex
    ) external pure override returns (bool slash, string memory reason) {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        require(txIndex < _block.body.txs.length, "out of index");
        Transaction memory transaction = _block.body.txs[txIndex];
        Outflow memory outflow = transaction.outflow[outflowIndex];
        bytes32 migrationId = outflow.getMigrationId();
        require(
            outflow.outflowType == uint8(OutflowType.Migration),
            "Not a migration output"
        );
        bool massMigrationExist;
        for (uint256 i = 0; i < _block.body.massMigrations.length; i++) {
            if (migrationId == _block.body.massMigrations[i].getMigrationId()) {
                massMigrationExist = true;
                break;
            }
        }
        // code M7: MassMigration for the given migration output does not exist.
        return (!massMigrationExist, "M7");
    }
}
