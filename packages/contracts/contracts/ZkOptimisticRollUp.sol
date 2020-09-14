// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;
pragma experimental ABIEncoderV2;

import { ISetupWizard } from "./interfaces/ISetupWizard.sol";
import { Layer2 } from "./storage/Layer2.sol";
import { Layer2Controller } from "./Layer2Controller.sol";
import { SNARK } from "./libraries/SNARK.sol";
import { Blockchain, Header, Types } from "./libraries/Types.sol";
import { Pairing, G1Point, G2Point } from "./libraries/Pairing.sol";
import { Hash } from "./libraries/Hash.sol";
import { SMT254 } from "./libraries/SMT.sol";

contract ZkOptimisticRollUp is Layer2Controller, ISetupWizard {
    using Types for Header;
    using Types for Blockchain;

    address setupWizard;

    event GenesisBlock(
        bytes32 blockHash,
        address proposer,
        uint256 fromBlock,
        bytes32 parentBlock
    );

    constructor(address _setupWizard) public {
        setupWizard = _setupWizard;
    }

    modifier onlySetupWizard {
        require(msg.sender == setupWizard, "Not authorized");
        _;
    }

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
    ) public override onlySetupWizard {
        uint256 txSig = Types.getSNARKSignature(numOfInputs, numOfOutputs);
        SNARK.VerifyingKey storage key = Layer2.vks[txSig];
        key.alfa1 = vk.alfa1;
        key.beta2 = vk.beta2;
        key.gamma2 = vk.gamma2;
        key.delta2 = vk.delta2;
        require(key.ic.length == 0, "already registered");
        for (uint256 i = 0; i < vk.ic.length; i++) {
            key.ic.push(vk.ic[i]);
        }
    }

    /**
     * @dev It connects this proxy contract to the UserInteractable controller.
     */
    function makeUserInteractable(address addr) public override onlySetupWizard{
        Layer2Controller._connectUserInteractable(addr);
    }

    /**
     * @dev It connects this proxy contract to the Coordinatable controller.
     */
    function makeCoordinatable(address addr) public override onlySetupWizard{
        Layer2Controller._connectCoordinatable(addr);
    }

    /**
     * @dev It connects this proxy contract to the Challengeable controllers.
     */
    function makeChallengeable(
        address depositChallenge,
        address headerChallenge,
        address migrationChallenge,
        address utxoTreeChallenge,
        address withdrawalTreeChallenge,
        address nullifierTreeChallenge,
        address txChallenge
    ) public override onlySetupWizard {
        Layer2Controller._connectChallengeable(
            depositChallenge,
            headerChallenge,
            migrationChallenge,
            utxoTreeChallenge,
            withdrawalTreeChallenge,
            nullifierTreeChallenge,
            txChallenge
        );
    }

    /**
     * @dev It connects this proxy contract to the Migratable controller.
     */
    function makeMigratable(address addr) public override onlySetupWizard {
        Layer2Controller._connectMigratable(addr);
    }

    /**
     * @dev Migration process:
            1. On the destination contract, execute allowMigrants() to configure the allowed migrants.
               The departure contract should be in the allowed list.
            2. On the departure contract, execute migrateTo(). See "IMigratable.sol"
     * @param migrants List of contracts' address to allow migrations.
     */
    function allowMigrants(address[] memory migrants) public override onlySetupWizard {
        for (uint256 i = 0; i < migrants.length; i++) {
            Layer2.allowedMigrants[migrants[i]] = true;
        }
    }

    /**
     * @dev If you once execute this, every configuration freezes and does not change forever.
     */
    function completeSetup() public override onlySetupWizard {
        delete setupWizard;
        require(Layer2.chain.latest == bytes32(0), "Already initialized");
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
            msg.sender,
            parentBlock,
            uint256(0),
            utxoRoot,
            uint256(0),
            nullifierRoot,
            withdrawalRoot,
            uint256(0),
            bytes32(0),
            bytes32(0),
            bytes32(0)
        );
        bytes32 genesis = header.hash();
        Layer2.chain.init(genesis);
        emit GenesisBlock(
            genesis,
            msg.sender,
            block.number,
            parentBlock
        );
    }
}
