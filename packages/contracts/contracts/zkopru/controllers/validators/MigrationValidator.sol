// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import { Storage } from "../../storage/Storage.sol";
import {
    Block,
    Transaction,
    Outflow,
    MassDeposit,
    MassMigration,
    ERC20Migration,
    ERC721Migration,
    OutflowType,
    Types
} from "../../libraries/Types.sol";
import { Deserializer } from "../../libraries/Deserializer.sol";
import { IMigrationValidator } from "../../interfaces/validators/IMigrationValidator.sol";

contract MigrationValidator is Storage, IMigrationValidator {
    using Types for Outflow;

    /**
     * @param // blockData Serialized block data
     * @param massMigrationIdx1 mass migration index in the block body
     * @param massMigrationIdx2 mass migration index in the block body that has same destination
            with the first mass migration
     */
    function validateDuplicatedDestination(
        bytes calldata,
        uint256 massMigrationIdx1,
        uint256 massMigrationIdx2
    )
    external
    pure
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        require(massMigrationIdx1 < _block.body.massMigrations.length, "out of index");
        require(massMigrationIdx2 < _block.body.massMigrations.length, "out of index");
        MassMigration memory m1 = _block.body.massMigrations[massMigrationIdx1];
        MassMigration memory m2 = _block.body.massMigrations[massMigrationIdx2];
        // code M1: Duplicated MassMigration destinations exist
        return (m1.destination == m2.destination, "M1");
    }

    /**
     * @param // blockData Serialized block data
     * @param migrationIndex Index of the mass migration to challenge
     */
    function validateTotalEth(
        bytes calldata,
        uint256 migrationIndex
    )
    external
    pure
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        require(migrationIndex < _block.body.massMigrations.length, "out of index");
        MassMigration memory migration = _block.body.massMigrations[migrationIndex];
        uint256 totalETH;
        for(uint256 i = 0; i < _block.body.txs.length; i++) {
            Transaction memory transaction = _block.body.txs[i];
            for(uint256 j = 0; j < transaction.outflow.length; j++) {
                Outflow memory outflow = transaction.outflow[j];
                if(outflow.outflowType == uint8(OutflowType.Migration) && outflow.publicData.to == migration.destination) {
                    totalETH += outflow.publicData.eth;
                }
            }
        }
        // code M2: MassMigration is carrying invalid amount of ETH
        return (totalETH != migration.totalETH, "M2");
    }

    /**
     * @param // blockData Serialized block data
     * @param migrationIndex Index of the mass migration to challenge
     */
    function validateMergedLeaves(
        bytes calldata,
        uint256 migrationIndex
    )
    external
    pure
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        require(migrationIndex < _block.body.massMigrations.length, "out of index");
        MassMigration memory migration = _block.body.massMigrations[migrationIndex];
        MassDeposit memory migratingLeaves;
        for(uint256 i = 0; i < _block.body.txs.length; i++) {
            Transaction memory transaction = _block.body.txs[i];
            for(uint256 j = 0; j < transaction.outflow.length; j++) {
                Outflow memory outflow = transaction.outflow[j];
                if(outflow.outflowType == uint8(OutflowType.Migration) && outflow.publicData.to == migration.destination) {
                    migratingLeaves.merged = keccak256(abi.encodePacked(migratingLeaves.merged, outflow.note));
                }
            }
        }
        // code M3: MassMigration is carrying invalid merged leaves value
        return (migratingLeaves.merged != migration.migratingLeaves.merged, "M3");
    }

    /**
     * @param // blockData Serialized block data
     * @param migrationIndex Index of the mass migration to challenge
     */
    function validateMigrationFee(
        bytes calldata,
        uint256 migrationIndex
    )
    external
    pure
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        require(migrationIndex < _block.body.massMigrations.length, "out of index");
        MassMigration memory migration = _block.body.massMigrations[migrationIndex];
        MassDeposit memory migratingLeaves;
        for(uint256 i = 0; i < _block.body.txs.length; i++) {
            Transaction memory transaction = _block.body.txs[i];
            for(uint256 j = 0; j < transaction.outflow.length; j++) {
                Outflow memory outflow = transaction.outflow[j];
                if(outflow.outflowType == uint8(OutflowType.Migration) && outflow.publicData.to == migration.destination) {
                    migratingLeaves.fee += outflow.publicData.fee;
                }
            }
        }
        // code M4: Aggregated migration fee is not correct
        return (migratingLeaves.fee != migration.migratingLeaves.fee, "M4");
    }

    function validateDuplicatedERC20Migration(
        bytes calldata,
        uint256 migrationIndex,
        uint256 erc20MigrationIdx1,
        uint256 erc20MigrationIdx2
    )
    external
    pure
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        require(migrationIndex < _block.body.massMigrations.length, "out of index");
        MassMigration memory massMigration = _block.body.massMigrations[migrationIndex];
        require(erc20MigrationIdx1 < massMigration.erc20.length, "erc20 idx1 out of index");
        require(erc20MigrationIdx2 < massMigration.erc20.length, "erc20 idx1 out of index");
        ERC20Migration memory erc20Migration1 = massMigration.erc20[erc20MigrationIdx1];
        ERC20Migration memory erc20Migration2 = massMigration.erc20[erc20MigrationIdx2];
        // code M5: Duplicated ERC20 migration destinations exist
        return (erc20Migration1.addr == erc20Migration2.addr, "M5");
    }

    function validateERC20Amount(
        bytes calldata,
        uint256 migrationIndex,
        uint256 erc20Index
    )
    external
    pure
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        require(migrationIndex < _block.body.massMigrations.length, "out of index");
        MassMigration memory migration = _block.body.massMigrations[migrationIndex];
        require(erc20Index < migration.erc20.length, "Invalid erc20 index");
        ERC20Migration memory erc20Migration = migration.erc20[erc20Index];
        uint256 erc20Amount;
        for(uint256 i = 0; i < _block.body.txs.length; i++) {
            Transaction memory transaction = _block.body.txs[i];
            for(uint256 j = 0; j < transaction.outflow.length; j++) {
                Outflow memory outflow = transaction.outflow[j];
                if(
                    outflow.outflowType == uint8(OutflowType.Migration) &&
                    outflow.publicData.to == migration.destination &&
                    outflow.publicData.token == erc20Migration.addr
                ) {
                    erc20Amount += outflow.publicData.amount;
                }
            }
        }
        // code M6: MassMigration is carrying invalid amount of token
        return (erc20Amount == erc20Migration.amount, "M6");
    }

    function validateDuplicatedERC721Migration(
        bytes calldata,
        uint256 migrationIndex,
        uint256 erc721MigrationIdx1,
        uint256 erc721MigrationIdx2
    )
    external
    pure
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        require(migrationIndex < _block.body.massMigrations.length, "out of index");
        MassMigration memory massMigration = _block.body.massMigrations[migrationIndex];
        require(erc721MigrationIdx1 < massMigration.erc721.length, "erc721 idx1 out of index");
        require(erc721MigrationIdx2 < massMigration.erc721.length, "erc721 idx1 out of index");
        ERC721Migration memory erc721Migration1 = massMigration.erc721[erc721MigrationIdx1];
        ERC721Migration memory erc721Migration2 = massMigration.erc721[erc721MigrationIdx2];
        // code M7: Duplicated ERC721 migration destinations exist
        return (erc721Migration1.addr == erc721Migration2.addr, "M7");
    }

    function validateNonFungibility(
        bytes calldata,
        uint256 migrationIndex,
        uint256 erc721Index,
        uint256 tokenId
    )
    external
    pure
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        require(migrationIndex < _block.body.massMigrations.length, "out of index");
        MassMigration memory migration = _block.body.massMigrations[migrationIndex];
        require(erc721Index < migration.erc721.length, "Invalid erc20 index");
        ERC721Migration memory erc721Migration = migration.erc721[erc721Index];
        uint256 nftCount = 0;
        for (uint256 i = 0; i < erc721Migration.nfts.length; i++) {
            if(tokenId == erc721Migration.nfts[i]) {
                nftCount ++;
            }
        }
        if(nftCount > 1) {
            // NFT id should be unique
            // code M8: MassMigration is destroying the non-fungibility of a token
            return (true, "M8");
        }
    }

    function validateNftExistence(
        bytes calldata,
        uint256 migrationIndex,
        uint256 erc721Index,
        uint256 tokenId
    )
    external
    pure
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        require(migrationIndex < _block.body.massMigrations.length, "out of index");
        MassMigration memory migration = _block.body.massMigrations[migrationIndex];
        require(erc721Index < migration.erc721.length, "Invalid erc20 index");
        ERC721Migration memory erc721Migration = migration.erc721[erc721Index];

        bool shouldMigrateNft;
        for (uint256 i = 0; i < erc721Migration.nfts.length; i++) {
            if(tokenId == erc721Migration.nfts[i]) {
                shouldMigrateNft = true;
                break;
            }
        }
        bool nftExistsInMigrationLeaves;
        for(uint256 i = 0; i < _block.body.txs.length; i++) {
            Transaction memory transaction = _block.body.txs[i];
            for(uint256 j = 0; j < transaction.outflow.length; j++) {
                Outflow memory outflow = transaction.outflow[j];
                if (
                    outflow.outflowType == uint8(OutflowType.Migration) &&
                    outflow.publicData.to == migration.destination &&
                    outflow.publicData.token == erc721Migration.addr &&
                    outflow.publicData.nft == tokenId
                ) {
                    nftExistsInMigrationLeaves = true;
                    break;
                }
            }
            if (nftExistsInMigrationLeaves) break;
        }
        // code M9: MassMigration is not including an NFT
        return (shouldMigrateNft != nftExistsInMigrationLeaves, "M9");
    }
}
