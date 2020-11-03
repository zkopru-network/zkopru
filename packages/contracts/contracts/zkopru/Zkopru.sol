// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;
pragma experimental ABIEncoderV2;

import { ISetupWizard } from "./interfaces/ISetupWizard.sol";
import { Storage } from "./storage/Storage.sol";
import { Reader } from "./storage/Reader.sol";
import { Proxy } from "./Proxy.sol";
import { SNARK } from "./libraries/SNARK.sol";
import { Blockchain, Header, Types } from "./libraries/Types.sol";
import { Pairing, G1Point, G2Point } from "./libraries/Pairing.sol";
import { Hash } from "./libraries/Hash.sol";

contract Zkopru is Proxy, Reader, ISetupWizard {
    using Types for Header;
    using Types for Blockchain;

    event GenesisBlock(
        bytes32 blockHash,
        address proposer,
        uint256 fromBlock,
        bytes32 parentBlock
    );

    /**
     * @dev This configures a zk SNARK verification key to support the given transaction type
     * @param numOfInputs Number of inflow UTXOs
     * @param numOfOutputs Number of outflow UTXOs
     * @param vk SNARK verifying key for the given transaction type
     */
    function registerVk(
        uint8 numOfInputs,
        uint8 numOfOutputs,
        SNARK.VerifyingKey memory vk
    ) public override onlyOwner {
        uint256 txSig = Types.getSNARKSignature(numOfInputs, numOfOutputs);
        SNARK.VerifyingKey storage key = Storage.vks[txSig];
        require(key.ic.length == 0, "already registered");
        require(key.alpha1.X == 0, "already registered");
        require(key.alpha1.Y == 0, "already registered");
        require(key.beta2.X[0] == 0, "already registered");
        require(key.beta2.X[1] == 0, "already registered");
        require(key.beta2.Y[0] == 0, "already registered");
        require(key.beta2.Y[1] == 0, "already registered");
        require(key.gamma2.X[0] == 0, "already registered");
        require(key.gamma2.X[1] == 0, "already registered");
        require(key.gamma2.Y[0] == 0, "already registered");
        require(key.gamma2.Y[1] == 0, "already registered");
        require(key.delta2.X[0] == 0, "already registered");
        require(key.delta2.X[1] == 0, "already registered");
        require(key.delta2.Y[0] == 0, "already registered");
        require(key.delta2.Y[1] == 0, "already registered");
        key.alpha1 = vk.alpha1;
        key.beta2 = vk.beta2;
        key.gamma2 = vk.gamma2;
        key.delta2 = vk.delta2;
        for (uint256 i = 0; i < vk.ic.length; i++) {
            key.ic.push(vk.ic[i]);
        }
    }

    /**
     * @dev It connects this proxy contract to the UserInteractable controller.
     */
    function makeUserInteractable(address addr) public override onlyOwner {
        Proxy._connectUserInteractable(addr);
    }

    /**
     * @dev It connects this proxy contract to the Coordinatable controller.
     */
    function makeConfigurable(address addr) public override onlyOwner {
        Proxy._connectConfigurable(addr);
    }

    /**
     * @dev It connects this proxy contract to the Coordinatable controller.
     */
    function makeCoordinatable(address addr) public override onlyOwner {
        Proxy._connectCoordinatable(addr);
    }

    /**
     * @dev It connects this proxy contract to the Challengeable controllers.
     */
    function makeChallengeable(
        address challengeable,
        address depositValidator,
        address headerValidator,
        address migrationValidator,
        address utxoTreeValidator,
        address withdrawalTreeValidator,
        address nullifierTreeValidator,
        address txValidator
    ) public override onlyOwner {
        Proxy._connectChallengeable(
            challengeable,
            depositValidator,
            headerValidator,
            migrationValidator,
            utxoTreeValidator,
            withdrawalTreeValidator,
            nullifierTreeValidator,
            txValidator
        );
    }

    /**
     * @dev It connects this proxy contract to the Migratable controller.
     */
    function makeMigratable(address addr) public override onlyOwner {
        Proxy._connectMigratable(addr);
    }

    /**
     * @dev Migration process:
            1. On the destination contract, execute allowMigrants() to configure the allowed migrants.
               The departure contract should be in the allowed list.
            2. On the departure contract, execute migrateTo(). See "IMigratable.sol"
     * @param migrants List of contracts' address to allow migrations.
     */
    function allowMigrants(address[] memory migrants) public override onlyOwner {
        for (uint256 i = 0; i < migrants.length; i++) {
            Storage.allowedMigrants[migrants[i]] = true;
        }
    }

    /**
     * @dev If you once execute this, every configuration freezes and does not change forever.
     */
    function completeSetup() public override onlyOwner {
        require(Storage.chain.latest == bytes32(0), "Already initialized");
        uint256[] memory poseidonPreHashes = Hash.poseidonPrehashedZeroes();
        uint256 utxoRoot = poseidonPreHashes[poseidonPreHashes.length - 1];
        uint256[] memory keccakPreHashes = Hash.keccakPrehashedZeroes();
        uint256 withdrawalRoot = keccakPreHashes[keccakPreHashes.length - 1];
        bytes32 nullifierRoot = bytes32(0);
        for (uint256 i = 0; i < NULLIFIER_TREE_DEPTH; i++) {
            nullifierRoot = keccak256(abi.encodePacked(nullifierRoot, nullifierRoot));
        }
        bytes32 parentBlock = blockhash(block.number - 1);
        Header memory header = Header(
            msg.sender, // proposer
            parentBlock,
            uint256(0),  // total fee
            utxoRoot, // root of the utxo tree
            uint256(0), // index of the utxo tree
            nullifierRoot, // root of the nullifier tree
            withdrawalRoot, // root of the withdrawal tree
            uint256(0), // index of the withdrawal tree
            bytes32(0), // tx root
            bytes32(0), // mass deposit root
            bytes32(0) // mass migration root
        );
        bytes32 genesis = header.hash();
        Storage.chain.init(genesis);
        emit GenesisBlock(
            genesis,
            msg.sender,
            block.number,
            parentBlock
        );
    }
}
