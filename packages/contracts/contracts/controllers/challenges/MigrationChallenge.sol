pragma solidity = 0.6.12;

import { Layer2 } from "../../storage/Layer2.sol";
import { Challengeable } from "../Challengeable.sol";
import { SNARK } from "../../libraries/SNARK.sol";
import { SMT254 } from "../../libraries/SMT.sol";
import {
    Block,
    Challenge,
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

contract MigrationChallenge is Challengeable {
    using SMT254 for SMT254.OPRU;
    using SNARK for SNARK.VerifyingKey;
    using Types for Outflow;


    /**
     * @param destination Address of another layer 2 contract
     * @param blockData Serialized block data
     */
    function challengeDuplicatedDestination(
        address destination,
        bytes calldata blockData
    ) external {
        bytes32 proposalId = keccak256(blockData);
        Block memory _block = Deserializer.blockFromCalldataAt(1);
        Challenge memory result = _challengeResultOfDuplicatedDestination(_block, destination);
        _execute(proposalId, result);
    }

    /**
     * @param migrationIndex Index of the mass migration to challenge
     * @param blockData Serialized block data
     */
    function challengeTotalEth(
        uint256 migrationIndex,
        bytes calldata blockData
    ) external {
        bytes32 proposalId = keccak256(blockData);
        Block memory _block = Deserializer.blockFromCalldataAt(1);
        Challenge memory result = _challengeResultOfTotalEth(_block, migrationIndex);
        _execute(proposalId, result);
    }


    /**
     * @param migrationIndex Index of the mass migration to challenge
     * @param blockData Serialized block data
     */
    function challengeMergedLeaves(
        uint256 migrationIndex,
        bytes calldata blockData
    ) external {
        bytes32 proposalId = keccak256(blockData);
        Block memory _block = Deserializer.blockFromCalldataAt(1);
        Challenge memory result = _challengeResultOfMergedLeaves(_block, migrationIndex);
        _execute(proposalId, result);
    }

    /**
     * @param migrationIndex Index of the mass migration to challenge
     * @param blockData Serialized block data
     */
    function challengeMigrationFee(
        uint256 migrationIndex,
        bytes calldata blockData
    ) external {
        bytes32 proposalId = keccak256(blockData);
        Block memory _block = Deserializer.blockFromCalldataAt(1);
        Challenge memory result = _challengeResultOfMigrationFee(_block, migrationIndex);
        _execute(proposalId, result);
    }

    function challengeDuplicatedERC20Migration(
        uint256 migrationIndex,
        address erc20Address,
        bytes calldata blockData
    ) external {
        bytes32 proposalId = keccak256(blockData);
        Block memory _block = Deserializer.blockFromCalldataAt(2);
        Challenge memory result = _challengeResultOfDuplicatedERC20Migration(_block, migrationIndex, erc20Address);
        _execute(proposalId, result);
    }

    function challengeERC20Amount(
        uint256 migrationIndex,
        uint256 erc20Index,
        bytes calldata blockData
    ) external {
        bytes32 proposalId = keccak256(blockData);
        Block memory _block = Deserializer.blockFromCalldataAt(2);
        Challenge memory result = _challengeResultOfERC20Amount(_block, migrationIndex, erc20Index);
        _execute(proposalId, result);
    }

    function challengeDuplicatedERC721Migration(
        uint256 migrationIndex,
        address erc20Address,
        bytes calldata blockData
    ) external {
        bytes32 proposalId = keccak256(blockData);
        Block memory _block = Deserializer.blockFromCalldataAt(2);
        Challenge memory result = _challengeResultOfDuplicatedERC721Migration(_block, migrationIndex, erc20Address);
        _execute(proposalId, result);
    }

    function challengeNonFungibility(
        uint256 migrationIndex,
        uint256 erc721Index,
        uint256 tokenId,
        bytes calldata blockData
    ) external {
        bytes32 proposalId = keccak256(blockData);
        Block memory _block = Deserializer.blockFromCalldataAt(2);
        Challenge memory result = _challengeResultOfNonFungibility(_block, migrationIndex, erc721Index, tokenId);
        _execute(proposalId, result);
    }

    function challengeNftExistence(
        uint256 migrationIndex,
        uint256 erc721Index,
        uint256 tokenId,
        bytes calldata blockData
    ) external {
        bytes32 proposalId = keccak256(blockData);
        Block memory _block = Deserializer.blockFromCalldataAt(2);
        Challenge memory result = _challengeResultOfNFTExistence(
            _block,
            migrationIndex,
            erc721Index,
            tokenId
        );
        _execute(proposalId, result);
    }

    function _challengeResultOfDuplicatedDestination(
        Block memory _block,
        address destination
    )
        internal
        pure
        returns (Challenge memory)
    {
        require(destination != address(0), "Invalid destination");
        uint8 count;
        for (uint256 i = 0; i < _block.body.massMigrations.length; i++) {
            if (destination == _block.body.massMigrations[i].destination) {
                count++;
            }
            if (count >= 2) {
                return Challenge(
                    true,
                    _block.header.proposer,
                    "Duplicated MassMigration destination"
                );
            }
        }
    }

    function _challengeResultOfTotalEth(
        Block memory _block,
        uint256 migrationIndex
    )
        internal
        pure
        returns (Challenge memory)
    {
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
        return Challenge(
            totalETH != migration.totalETH,
            _block.header.proposer,
            "Invalid total ETH"
        );
    }


    function _challengeResultOfMergedLeaves(
        Block memory _block,
        uint256 migrationIndex
    )
        internal
        pure
        returns (Challenge memory)
    {
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
        return Challenge(
            migratingLeaves.merged != migration.migratingLeaves.merged,
            _block.header.proposer,
            "Invalid merged leaves "
        );
    }

    function _challengeResultOfMigrationFee(
        Block memory _block,
        uint256 migrationIndex
    )
        internal
        pure
        returns (Challenge memory)
    {
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
        return Challenge(
            migratingLeaves.fee != migration.migratingLeaves.fee,
            _block.header.proposer,
            "Invalid migration fee aggregation"
        );
    }

    function _challengeResultOfDuplicatedERC20Migration(
        Block memory _block,
        uint256 migrationIndex,
        address erc20Address
    )
        internal
        pure
        returns (Challenge memory)
    {
        require(migrationIndex < _block.body.massMigrations.length, "out of index");
        require(erc20Address != address(0), "Invalid erc20 address");
        MassMigration memory massMigration = _block.body.massMigrations[migrationIndex];
        uint8 count = 0;
        for(uint256 j = 0; j < massMigration.erc20.length; j++) {
            ERC20Migration memory erc20Migration = massMigration.erc20[j];
            if(erc20Migration.addr == erc20Address) {
                count++;
            }
            if (count >= 2) {
                // There exist more than 2 of erc20 migration against the address.
                return Challenge(
                    true,
                    _block.header.proposer,
                    "Duplicated ERC20 migration dests exist"
                );
            }
        }
    }

    function _challengeResultOfERC20Amount(
        Block memory _block,
        uint migrationIndex,
        uint erc20Index
    )
        internal
        pure
        returns (Challenge memory)
    {
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
        return Challenge(
            erc20Amount == erc20Migration.amount,
            _block.header.proposer,
            "Migrating amount of token is invalid"
        );
    }

    function _challengeResultOfERC721Migration(
        Block memory _block,
        address destination,
        address erc721,
        uint256 tokenId
    )
        internal
        pure
        returns (Challenge memory)
    {
        ERC721Migration memory migration;
        for(uint256 i = 0; i < _block.body.massMigrations.length; i++) {
            MassMigration memory massMigration = _block.body.massMigrations[i];
            if(destination == massMigration.destination) {
                for(uint256 j = 0; j < massMigration.erc721.length; j++) {
                    ERC721Migration memory erc721Migration = massMigration.erc721[j];
                    if(erc721Migration.addr == erc721) {
                        if(erc721Migration.addr != address(0)) {
                            // There exist more than 2 of erc721 migration against the address.
                            return Challenge(
                                true,
                                _block.header.proposer,
                                "Duplicated ERC721 migration dests exist"
                            );
                        }
                        migration = erc721Migration;
                    }
                }
            }
        }
        uint256 migrationNftCount = 0;
        for (uint256 i = 0; i < migration.nfts.length; i++) {
            if(tokenId == migration.nfts[i]) {
                migrationNftCount ++;
            }
        }
        if(migrationNftCount > 1) {
            return Challenge(
                true,
                _block.header.proposer,
                "It destroys the non-fungibility"
            );
        }

        uint256 computedNftCount;
        for(uint256 i = 0; i < _block.body.txs.length; i++) {
            Transaction memory transaction = _block.body.txs[i];
            for(uint256 j = 0; j < transaction.outflow.length; j++) {
                Outflow memory outflow = transaction.outflow[j];
                if(
                    outflow.outflowType == uint8(OutflowType.Migration) &&
                    outflow.publicData.to == destination &&
                    outflow.publicData.token == erc721 &&
                    outflow.publicData.nft == tokenId
                ) {
                    computedNftCount += 1;
                }
            }
        }
        return Challenge(
            migrationNftCount == computedNftCount,
            _block.header.proposer,
            "Invalid nft migration"
        );
    }

    function _challengeResultOfDuplicatedERC721Migration(
        Block memory _block,
        uint256 migrationIndex,
        address erc721Address
    )
        internal
        pure
        returns (Challenge memory)
    {
        require(migrationIndex < _block.body.massMigrations.length, "out of index");
        require(erc721Address != address(0), "Invalid erc20 address");
        MassMigration memory massMigration = _block.body.massMigrations[migrationIndex];
        uint8 count = 0;
        for(uint256 j = 0; j < massMigration.erc20.length; j++) {
            ERC721Migration memory erc721Migration = massMigration.erc721[j];
            if(erc721Migration.addr == erc721Address) {
                count++;
            }
            if (count >= 2) {
                // There exist more than 2 of erc20 migration against the address.
                return Challenge(
                    true,
                    _block.header.proposer,
                    "Duplicated ERC721 migration dests exist"
                );
            }
        }
    }

    function _challengeResultOfNonFungibility(
        Block memory _block,
        uint256 migrationIndex,
        uint256 erc721Index,
        uint256 tokenId
    )
        internal
        pure
        returns (Challenge memory)
    {
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
            return Challenge(
                true,
                _block.header.proposer,
                "It destroys the non-fungibility"
            );
        }
    }

    function _challengeResultOfNFTExistence(
        Block memory _block,
        uint256 migrationIndex,
        uint256 erc721Index,
        uint256 tokenId
    )
        internal
        pure
        returns (Challenge memory)
    {
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
        return Challenge(
            shouldMigrateNft != nftExistsInMigrationLeaves,
            _block.header.proposer,
            "NFT does not match"
        );
    }
}
