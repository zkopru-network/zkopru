pragma solidity = 0.6.12;

import { Layer2 } from "../storage/Layer2.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { MassDeposit, MassMigration, Types } from "../libraries/Types.sol";
import { Deserializer } from "../libraries/Deserializer.sol";


contract Migratable is Layer2 {
    using Types for *;

    event NewMassMigration(bytes32 checksum, address network, bytes32 merged, uint256 fee);

    function migrateTo(
        bytes32 checksum,
        bytes calldata
    ) external {
        MassMigration memory migration = Deserializer.massMigrationFromCalldataAt(1);
        address to = migration.destination;
        bytes32 migrationId = keccak256(abi.encodePacked(checksum, migration.hash()));
        require(chain.migrations[migrationId], "MassMigration does not exist");
        try Migratable(to).acceptMigration(
            migrationId,
            migration.migratingLeaves.merged,
            migration.migratingLeaves.fee
        ) {
            // TODO: Handle out of gas due to the push pattern => ex: slash proposer using checksum?
            // send ETH first
            payable(to).transfer(migration.totalETH);
            // send ERC20
            for(uint256 i = 0; i < migration.erc20.length; i++) {
                IERC20(migration.erc20[i].addr).transfer(to, migration.erc20[i].amount);
            }
            // send ERC721
            for(uint256 i = 0; i < migration.erc721.length; i++) {
                for(uint256 j = 0; j < migration.erc721[i].nfts.length; j++) {
                    IERC721(migration.erc721[i].addr).transferFrom(
                        address(this),
                        to,
                        migration.erc721[i].nfts[j]
                    );
                }
            }
            // Delete mass migration
            delete chain.migrations[migrationId];
        } catch {
           revert("Dest contract denied migration");
        }
    }

    function acceptMigration(bytes32 checksum, bytes32 merged, uint256 fee) external virtual {
        require(Layer2.allowedMigrants[msg.sender], "Not an allowed departure");
        Layer2.chain.committedDeposits[MassDeposit(merged,fee).hash()] += 1;
        emit NewMassMigration(checksum, msg.sender, merged, fee);
    }
}
