pragma solidity = 0.6.12;

import { ISetupWizard } from "./interfaces/ISetupWizard.sol";
import { Layer2 } from "./storage/Layer2.sol";
import { Layer2Controller } from "./Layer2Controller.sol";
import { SNARKsVerifier } from "./libraries/SNARKs.sol";
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

    function registerVk(
        uint8 numOfInputs,
        uint8 numOfOutputs,
        uint256[2] memory alfa1,
        uint256[2][2] memory beta2,
        uint256[2][2] memory gamma2,
        uint256[2][2] memory delta2,
        uint256[2][] memory ic
    ) public override onlySetupWizard {
        bytes32 txSig = Types.getSNARKsSignature(numOfInputs, numOfOutputs);
        SNARKsVerifier.VerifyingKey storage vk = Layer2.vks[txSig];
        vk.alfa1 = G1Point(alfa1[0], alfa1[1]);
        vk.beta2 = G2Point(beta2[0], beta2[1]);
        vk.gamma2 = G2Point(gamma2[0], gamma2[1]);
        vk.delta2 = G2Point(delta2[0], delta2[1]);
        for (uint256 i = 0; i < ic.length; i++) {
            vk.ic.push(G1Point(ic[i][0], ic[i][1]));
        }
    }

    function makeUserInteractable(address addr) public override onlySetupWizard{
        Layer2Controller._connectUserInteractable(addr);
    }

    function makeCoordinatable(address addr) public onlySetupWizard{
        Layer2Controller._connectCoordinatable(addr);
    }

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

    function makeMigratable(address addr) public override onlySetupWizard {
        Layer2Controller._connectMigratable(addr);
    }

    function allowMigrants(address[] memory migrants) public override onlySetupWizard {
        for (uint256 i = 0; i < migrants.length; i++) {
            Layer2.allowedMigrants[migrants[i]] = true;
        }
    }

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
            bytes32(0),
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
