// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import { Layer2 } from "../../storage/Layer2.sol";
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

contract MigrationValidator is Layer2, IMigrationValidator {
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
    view
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        require(massMigrationIdx1 < _block.body.massMigrations.length, "out of index");
        require(massMigrationIdx2 < _block.body.massMigrations.length, "out of index");
        MassMigration memory m1 = _block.body.massMigrations[massMigrationIdx1];
        MassMigration memory m2 = _block.body.massMigrations[massMigrationIdx2];
        return (m1.destination == m2.destination, "Duplicated MassMigration destination");
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
    view
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
        return (totalETH != migration.totalETH, "Invalid total ETH");
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
    view
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
        return (
            migratingLeaves.merged != migration.migratingLeaves.merged,
            "Invalid merged leaves "
        );
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
    view
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
        return (
            migratingLeaves.fee != migration.migratingLeaves.fee,
            "Invalid migration fee aggregation"
        );
    }

    function validateDuplicatedERC20Migration(
        bytes calldata,
        uint256 migrationIndex,
        uint256 erc20MingrationIdx1,
        uint256 erc20MingrationIdx2
    )
    external
    view
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        require(migrationIndex < _block.body.massMigrations.length, "out of index");
        MassMigration memory massMigration = _block.body.massMigrations[migrationIndex];
        require(erc20MingrationIdx1 < massMigration.erc20.length, "erc20 idx1 out of index");
        require(erc20MingrationIdx2 < massMigration.erc20.length, "erc20 idx1 out of index");
        ERC20Migration memory erc20Migration1 = massMigration.erc20[erc20MingrationIdx1];
        ERC20Migration memory erc20Migration2 = massMigration.erc20[erc20MingrationIdx2];
        return (
            erc20Migration1.addr == erc20Migration2.addr,
            "Duplicated ERC20 migration dests exist"
        );
    }

    function validateERC20Amount(
        bytes calldata,
        uint256 migrationIndex,
        uint256 erc20Index
    )
    external
    view
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
        return (
            erc20Amount == erc20Migration.amount,
            "Migrating amount of token is invalid"
        );
    }

    function validateDuplicatedERC721Migration(
        bytes calldata,
        uint256 migrationIndex,
        uint256 erc721MingrationIdx1,
        uint256 erc721MingrationIdx2
    )
    external
    view
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        require(migrationIndex < _block.body.massMigrations.length, "out of index");
        MassMigration memory massMigration = _block.body.massMigrations[migrationIndex];
        require(erc721MingrationIdx1 < massMigration.erc721.length, "erc721 idx1 out of index");
        require(erc721MingrationIdx2 < massMigration.erc721.length, "erc721 idx1 out of index");
        ERC721Migration memory erc721Migration1 = massMigration.erc721[erc721MingrationIdx1];
        ERC721Migration memory erc721Migration2 = massMigration.erc721[erc721MingrationIdx2];
        return (
            erc721Migration1.addr == erc721Migration2.addr,
            "Duplicated ERC721 migration dests exist"
        );
    }

    function validateNonFungibility(
        bytes calldata,
        uint256 migrationIndex,
        uint256 erc721Index,
        uint256 tokenId
    )
    external
    view
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
            return (true, "It destroys the non-fungibility");
        }
    }

    function validateNftExistence(
        bytes calldata,
        uint256 migrationIndex,
        uint256 erc721Index,
        uint256 tokenId
    )
    external
    view
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
        return (
            shouldMigrateNft != nftExistsInMigrationLeaves,
            "NFT does not match"
        );
    }
}
