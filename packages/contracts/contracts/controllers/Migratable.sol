pragma solidity >= 0.6.0;

import { Layer2 } from "../storage/Layer2.sol";
import { IERC20 } from "../utils/IERC20.sol";
import { IERC721 } from "../utils/IERC721.sol";
import { MassDeposit, MassMigration, Types } from "../libraries/Types.sol";
import { Deserializer } from "../libraries/Deserializer.sol";


contract Migratable is Layer2 {
    using Types for *;

    event NewMassMigration(bytes32 submissionId, address network, bytes32 merged, uint fee);

    function migrateTo(
        bytes32 submissionId,
        bytes calldata
    ) external {
        MassMigration memory migration = Deserializer.massMigrationFromCalldataAt(1);
        address to = migration.destination;
        bytes32 migrationId = keccak256(abi.encodePacked(submissionId, migration.hash()));
        require(chain.migrations[migrationId], "MassMigration does not exist");
        try Migratable(to).acceptMigration(
            migrationId,
            migration.migratingLeaves.merged,
            migration.migratingLeaves.fee
        ) {
            // TODO: Handle out of gas due to the push pattern => ex: slash proposer using submissionId?
            // send ETH first
            payable(to).transfer(migration.totalETH);
            // send ERC20
            for(uint i = 0; i < migration.erc20.length; i++) {
                IERC20(migration.erc20[i].addr).transfer(to, migration.erc20[i].amount);
            }
            // send ERC721
            for(uint i = 0; i < migration.erc721.length; i++) {
                for(uint j = 0; j < migration.erc721[i].nfts.length; j++) {
                    IERC721(migration.erc721[i].addr).transferFrom(
                        address(this),
                        to,
                        migration.erc721[i].nfts[j]
                    );
                }
            }
            /// Delete mass migration
            delete chain.migrations[migrationId];
        } catch {
           revert("Dest contract denied migration");
        }
    }

    function acceptMigration(bytes32 submissionId, bytes32 merged, uint fee) external virtual {
        require(Layer2.allowedMigrants[msg.sender], "Not an allowed departure");
        Layer2.chain.committedDeposits[MassDeposit(merged,fee).hash()] += 1;
        emit NewMassMigration(submissionId, msg.sender, merged, fee);
    }
}
