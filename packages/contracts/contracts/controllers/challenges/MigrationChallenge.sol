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

    function challengeMassMigrationToMassDeposit(
        address destination,
        bytes calldata blockData
    ) external {
        bytes32 proposalId = keccak256(blockData);
        Block memory _block = Deserializer.blockFromCalldataAt(1);
        Challenge memory result = _challengeResultOfMassMigrationToMassDeposit(_block, destination);
        _execute(proposalId, result);
    }

    function challengeERC20Migration(
        address destination,
        address erc20,
        bytes calldata blockData
    ) external {
        bytes32 proposalId = keccak256(blockData);
        Block memory _block = Deserializer.blockFromCalldataAt(2);
        Challenge memory result = _challengeResultOfERC20Migration(_block, destination, erc20);
        _execute(proposalId, result);
    }

    function challengeERC721Migration(
        address destination,
        address erc721,
        uint256 tokenId,
        bytes calldata blockData
    ) external {
        bytes32 proposalId = keccak256(blockData);
        Block memory _block = Deserializer.blockFromCalldataAt(2);
        Challenge memory result = _challengeResultOfERC721Migration(
            _block,
            destination,
            erc721,
            tokenId
        );
        _execute(proposalId, result);
    }

    function _challengeResultOfMassMigrationToMassDeposit(
        Block memory _block,
        address destination
    )
        internal
        pure
        returns (Challenge memory)
    {
        MassMigration memory submitted;
        for(uint256 i = 0; i < _block.body.massMigrations.length; i++) {
            if(destination == _block.body.massMigrations[i].destination) {
                if(submitted.destination != address(0)) {
                    return Challenge(
                        true,
                        _block.header.proposer,
                        "Duplicated MassMigration destination"
                    );
                }
                submitted = _block.body.massMigrations[i];
            }
        }
        uint256 totalETH;
        MassDeposit memory migratingLeaves;
        for(uint256 i = 0; i < _block.body.txs.length; i++) {
            Transaction memory transaction = _block.body.txs[i];
            for(uint256 j = 0; j < transaction.outflow.length; j++) {
                Outflow memory outflow = transaction.outflow[j];
                if(outflow.outflowType == uint8(OutflowType.Migration) && outflow.publicData.to == destination) {
                    totalETH += outflow.publicData.eth;
                    migratingLeaves.fee += outflow.publicData.fee;
                    migratingLeaves.merged = keccak256(abi.encodePacked(migratingLeaves.merged, outflow.note));
                }
            }
        }
        bool validityOfMassDeposit;
        if(
            totalETH == submitted.totalETH &&
            migratingLeaves.merged == submitted.migratingLeaves.merged &&
            migratingLeaves.fee == submitted.migratingLeaves.fee
        ) {
            validityOfMassDeposit = true;
        } else {
            validityOfMassDeposit = false;
        }
        return Challenge(
            !validityOfMassDeposit,
            _block.header.proposer,
            "Computed mass deposit is different with the submitted"
        );
    }

    function _challengeResultOfERC20Migration(
        Block memory _block,
        address destination,
        address erc20
    )
        internal
        pure
        returns (Challenge memory)
    {
        ERC20Migration memory submitted;
        for(uint256 i = 0; i < _block.body.massMigrations.length; i++) {
            MassMigration memory massMigration = _block.body.massMigrations[i];
            if(destination == massMigration.destination) {
                for(uint256 j = 0; j < massMigration.erc20.length; j++) {
                    ERC20Migration memory erc20Migration = massMigration.erc20[j];
                    if(erc20Migration.addr == erc20) {
                        if(erc20Migration.addr != address(0)) {
                            // There exist more than 2 of erc20 migration against the address.
                            return Challenge(
                                true,
                                _block.header.proposer,
                                "Duplicated ERC20 migration dests exist"
                            );
                        }
                        submitted = erc20Migration;
                    }
                }
            }
        }

        uint256 erc20Amount;
        for(uint256 i = 0; i < _block.body.txs.length; i++) {
            Transaction memory transaction = _block.body.txs[i];
            for(uint256 j = 0; j < transaction.outflow.length; j++) {
                Outflow memory outflow = transaction.outflow[j];
                if(
                    outflow.outflowType == uint8(OutflowType.Migration) &&
                    outflow.publicData.to == destination &&
                    outflow.publicData.token == erc20
                ) {
                    erc20Amount += outflow.publicData.amount;
                }
            }
        }
        return Challenge(
            erc20Amount == submitted.amount,
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
        ERC721Migration memory submitted;
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
                        submitted = erc721Migration;
                    }
                }
            }
        }
        uint256 submittedNftCount = 0;
        for (uint256 i = 0; i < submitted.nfts.length; i++) {
            if(tokenId == submitted.nfts[i]) {
                submittedNftCount ++;
            }
        }
        if(submittedNftCount > 1) {
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
            submittedNftCount == computedNftCount,
            _block.header.proposer,
            "Invalid nft migration"
        );
    }
}
