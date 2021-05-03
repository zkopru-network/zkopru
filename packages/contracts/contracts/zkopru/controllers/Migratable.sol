// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.7.4;
pragma experimental ABIEncoderV2;

import { Storage } from "../storage/Storage.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { MassDeposit, MassMigration, Types } from "../libraries/Types.sol";
import { Deserializer } from "../libraries/Deserializer.sol";
import { MerkleTreeLib, Hasher } from "../libraries/MerkleTree.sol";
import { Hash } from "../libraries/Hash.sol";

contract Migratable is Storage {
    using Types for *;
    using MerkleTreeLib for Hasher;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    event NewMassMigration(
        address sourceNetwork,
        bytes32 migrationRoot,
        bytes32 migrationHash
    );

    modifier onlyDestination(address dest) {
        require(
            msg.sender == dest,
            "Only the destination contract can call this function."
        );
        _;
    }

    function migrateFrom(
        address source,
        bytes32 migrationRoot,
        MassMigration memory migration,
        uint256 index,
        bytes32[] memory siblings,
        bytes32[] memory leaves
    ) external {
        MassDeposit memory massDeposit = migration.depositForDest;
        address token = migration.asset.token;
        // 1. fetch prev balances
        uint256 prevEthBal = address(this).balance;
        uint256 prevTokenBal;
        if (token != address(0)) {
            prevTokenBal = IERC20(token).balanceOf(address(this));
        }
        // 2. transfer migration asset
        Migratable(source).transfer(migrationRoot, migration, index, siblings);
        // 3. fetch new balances
        uint256 newEthBal = address(this).balance;
        uint256 newTokenBal;
        if (token != address(0)) {
            newTokenBal = IERC20(token).balanceOf(address(this));
        }
        // 4.ccheck asset transfer validity
        require(
            prevEthBal.add(migration.asset.eth) == newEthBal,
            "Invalid ETH transfer"
        );
        require(
            prevTokenBal.add(migration.asset.amount) == newTokenBal,
            "Invalid Token transfer"
        );
        //  5. Check Mass Deposit Leaves
        bytes32 merged;
        for (uint256 i = 0; i < leaves.length; i++) {
            merged = keccak256(abi.encodePacked(merged, leaves[i]));
        }
        require(
            merged == migration.depositForDest.merged,
            "Data Availability problem."
        );
        // 6. Record the carried mass deposit as committed
        bytes32 migrationHash = migration.hash();
        bytes32 depositHash = massDeposit.hash();
        Storage.chain.committedDeposits[depositHash] += 1;
        emit NewMassMigration(source, migrationRoot, migrationHash);
    }

    function transfer(
        bytes32 migrationRoot,
        MassMigration memory migration,
        uint256 index,
        bytes32[] memory siblings
    ) external onlyDestination(migration.destination) {
        // 1. verify inclusion proof.
        uint256 _migrationRoot = uint256(migrationRoot);
        uint256 _leaf = uint256(migration.hash());
        uint256[] memory _siblings;
        assembly {
            _siblings := siblings
        }
        require(
            Storage.chain.migrationRoots[migrationRoot],
            "Migration root does not exist."
        );
        require(
            getHasher().merkleProof(_migrationRoot, _leaf, index, _siblings),
            "Failed to verify its inclusion."
        );
        // 2. check it's not transferred yet.
        require(
            !Storage.chain.transferredMigrations[migrationRoot][bytes32(_leaf)],
            "Already transferred."
        );
        // 3. record it as transferred.
        Storage.chain.transferredMigrations[migrationRoot][
            bytes32(_leaf)
        ] = true;
        // 4. transfer assets.
        // send ETH
        payable(migration.destination).transfer(migration.asset.eth);
        // send ERC20
        if (migration.asset.token != address(0)) {
            IERC20(migration.asset.token).safeTransfer(
                migration.destination,
                migration.asset.amount
            );
        }
    }

    function getHasher() internal pure returns (Hasher memory hasher) {
        hasher.parentOf = Hash.keccakParentOf;
    }
}
