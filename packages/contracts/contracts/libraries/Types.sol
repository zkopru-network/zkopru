// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import { G1Point, G2Point } from "./Pairing.sol";

struct Blockchain {
    bytes32 genesis;
    bytes32 latest;

    // For coordinating
    uint256 proposedBlocks;
    mapping(address=>Proposer) proposers;
    mapping(bytes32=>Proposal) proposals;
    mapping(bytes32=>bool) finalized; // blockhash => finalized?

    // For inclusion reference
    mapping(bytes32=>bytes32) parentOf; // childBlockHash => parentBlockHash
    mapping(bytes32=>uint256) utxoRootOf; // blockhash => utxoRoot
    mapping(uint256=>bool) finalizedUTXORoots; // all finalized utxo roots

    // For deposit
    MassDeposit stagedDeposits;
    uint256 stagedSize;
    uint256 massDepositId;
    mapping(bytes32=>uint256) committedDeposits;

    // For withdrawal
    mapping(bytes32=>uint256) withdrawalRootOf; // header => withdrawalRoot
    mapping(bytes32=>bool) withdrawn;
    mapping(bytes32=>address) newWithdrawalOwner;

    // For migrations
    mapping(bytes32=>bool) migrations;

    // For ERC20 and ERC721
    address[] registeredERC20s;
    address[] registeredERC721s;
}

struct MassDeposit {
    bytes32 merged;
    uint256 fee;
}

// needs gas limit
struct MassMigration {
    address destination;
    uint256 totalETH;
    MassDeposit migratingLeaves;
    ERC20Migration[] erc20;
    ERC721Migration[] erc721;
}

struct ERC20Migration {
    address addr;
    uint256 amount;
}

struct ERC721Migration {
    address addr;
    uint256[] nfts;
}

struct WithdrawalTree {
    // Merkle tree of WithdrawalTree notes
    uint256 root;
    uint256 index;
}

struct Finalization {
    bytes32 proposalChecksum;
    Header header;
    MassDeposit[] massDeposits;
    MassMigration[] massMigrations;
}

struct Proposer {
    uint256 stake;
    uint256 reward;
    uint256 exitAllowance;
}

struct Proposal {
    bytes32 headerHash;
    uint256 challengeDue;
    bool slashed;
}

struct Challenge {
    bool slash;
    address proposer;
    string message;
}

struct Block {
    Header header;
    Body body;
}

struct Header {
    // basic data
    address proposer;
    bytes32 parentBlock;
    uint256 fee;

    // UTXO roll up
    uint256 utxoRoot;
    uint256 utxoIndex;

    // Nullifier roll up
    bytes32 nullifierRoot;

    // Withdrawal roll up
    uint256 withdrawalRoot;
    uint256 withdrawalIndex;

    // Transactions
    bytes32 txRoot;
    bytes32 depositRoot;
    bytes32 migrationRoot;
}

struct Body {
    Transaction[] txs;
    MassDeposit[] massDeposits;
    MassMigration[] massMigrations;
}

struct Transaction {
    Inflow[] inflow;
    Outflow[] outflow;
    uint256 swap;
    uint256 fee;
    Proof proof;
    bytes memo; // encrypted memo field
}

struct Inflow {
    uint256 inclusionRoot;
    bytes32 nullifier;
}

struct Outflow {
    uint256 note;
    uint8 outflowType; // 0 = UTXO, 1 = Withdrawal, 2 = Migration
    PublicData publicData; // Only for withdrawal & migration
}

enum OutflowType { UTXO, Withdrawal, Migration }

// Only used for migration
struct PublicData {
    address to; // to == 0: UTXO / to == address(this): Withdrawal / else: Migration
    uint256 eth;
    address token;
    uint256 amount;
    uint256 nft;
    uint256 fee;
}

struct AtomicSwap {
    uint256[2] binder;
    uint256[2] counterpart;
}

struct Proof {
    G1Point a;
    G2Point b;
    G1Point c;
}

library Types {
    function init(Blockchain storage chain, bytes32 genesis) internal {
        chain.latest = genesis;
        chain.genesis = genesis;
        chain.proposedBlocks++;
    }

    function hash(Header memory header) internal pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                header.proposer,
                header.parentBlock,
                header.fee,
                header.utxoRoot,
                header.utxoIndex,
                header.nullifierRoot,
                header.withdrawalRoot,
                header.withdrawalIndex,
                header.txRoot,
                header.depositRoot,
                header.migrationRoot
            )
        );
    }

    function hash(Transaction memory transaction) internal pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                toBytes(transaction.inflow),
                toBytes(transaction.outflow),
                transaction.swap,
                toBytes(transaction.proof),
                transaction.fee
            )
        );
    }

    function toBytes(Inflow memory inflow) internal pure returns (bytes memory) {
        return abi.encodePacked(inflow.inclusionRoot, inflow.nullifier);
    }

    function toBytes(Inflow[] memory inflow) internal pure returns (bytes memory) {
        bytes memory packed;
        for(uint256 i = 0; i < inflow.length; i++) {
            packed = abi.encodePacked(packed, toBytes(inflow[i]));
        }
        return packed;
    }

    function toBytes(Outflow memory outflow) internal pure returns (bytes memory) {
        if(isUTXO(outflow)) {
            return abi.encodePacked(outflow.note);
        } else {
            return abi.encodePacked(
                outflow.note,
                outflow.publicData.to,
                outflow.publicData.eth,
                outflow.publicData.token,
                outflow.publicData.amount,
                outflow.publicData.nft,
                outflow.publicData.fee
            );
        }
    }

    function toBytes(Outflow[] memory outflow) internal pure returns (bytes memory) {
        bytes memory packed;
        for(uint256 i = 0; i < outflow.length; i++) {
            packed = abi.encodePacked(packed, toBytes(outflow[i]));
        }
        return packed;
    }

    function toBytes(AtomicSwap memory swap) internal pure returns (bytes memory) {
        return abi.encodePacked(
            swap.binder,
            swap.counterpart
        );
    }

    function toBytes(Proof memory proof) internal pure returns (bytes memory) {
        return abi.encodePacked(
            proof.a.X,
            proof.a.Y,
            proof.b.X[0],
            proof.b.X[1],
            proof.b.Y[0],
            proof.b.Y[1],
            proof.c.X,
            proof.c.Y
        );
    }

    function withdrawalNote(Outflow memory outflow) internal pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                outflow.publicData.to,
                outflow.publicData.eth,
                outflow.publicData.token,
                outflow.publicData.amount,
                outflow.publicData.nft,
                outflow.publicData.fee
            )
        );
    }

    function isUTXO(Outflow memory outflow) internal pure returns (bool) {
        return outflow.publicData.to == address(0);
    }

    function hash(MassDeposit memory massDeposit) internal pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                massDeposit.merged,
                massDeposit.fee
            )
        );
    }
    function hash(MassMigration memory massMigration) internal pure returns (bytes32) {
        bytes memory packed;
        packed = abi.encodePacked(
            packed,
            massMigration.destination,
            massMigration.migratingLeaves.merged,
            massMigration.migratingLeaves.fee
        );
        for(uint256 i = 0; i < massMigration.erc20.length; i++) {
            packed = abi.encodePacked(
                packed,
                massMigration.erc20[i].addr,
                massMigration.erc20[i].amount
            );
        }
        for(uint256 i = 0; i < massMigration.erc20.length; i++) {
            packed = abi.encodePacked(
                packed,
                massMigration.erc721[i].addr,
                massMigration.erc721[i].nfts
            );
        }
        return keccak256(packed);
    }

    function root(Transaction[] memory transactions) internal pure returns (bytes32) {
        bytes32[] memory leaves = new bytes32[](transactions.length);
        for(uint256 i = 0; i < transactions.length; i++) {
            leaves[i] = hash(transactions[i]);
        }
        return root(leaves);
    }

    function root(MassDeposit[] memory massDeposits) internal pure returns (bytes32) {
        bytes32[] memory leaves = new bytes32[](massDeposits.length);
        for(uint256 i = 0; i < massDeposits.length; i++) {
            leaves[i] = hash(massDeposits[i]);
        }
        return root(leaves);
    }

    function root(MassMigration[] memory massMigrations) internal pure returns (bytes32) {
        bytes32[] memory leaves = new bytes32[](massMigrations.length);
        for(uint256 i = 0; i < massMigrations.length; i++) {
            leaves[i] = hash(massMigrations[i]);
        }
        return root(leaves);
    }

    function root(bytes32[] memory leaves) internal pure returns (bytes32) {
        if(leaves.length == 0) {
            return bytes32(0);
        } else if(leaves.length == 1) {
            return leaves[0];
        }
        bytes32[] memory nodes = new bytes32[]((leaves.length + 1)/2);
        bool hasEmptyLeaf = leaves.length % 2 == 1;

        for (uint256 i = 0; i < nodes.length; i++) {
            if(hasEmptyLeaf && i == nodes.length - 1) {
                nodes[i] = keccak256(abi.encodePacked(leaves[i*2], bytes32(0)));
            } else {
                nodes[i] = keccak256(abi.encodePacked(leaves[i*2], leaves[i*2+1]));
            }
        }
        return root(nodes);
    }

    function root(uint256[] memory leaves) internal pure returns (bytes32) {
        bytes32[] memory converted;
        assembly {
            converted := leaves
        }
        return root(converted);
    }

    function isEmpty(PublicData memory publicData) internal pure returns (bool) {
        if(publicData.to != address(0)) return false;
        if(publicData.eth != 0) return false;
        if(publicData.token != address(0)) return false;
        if(publicData.amount != 0) return false;
        if(publicData.nft != 0) return false;
        if(publicData.fee != 0) return false;
        return true;
    }

    // TODO temporal calculation
    function maxChallengeCost(Block memory blockData) internal pure returns (uint256 maxCost) {
    }

    function getSNARKSignature(
        uint8 numberOfInputs,
        uint8 numberOfOutputs
    ) internal pure returns (uint256) {
        return (uint256(numberOfInputs) << 128) + numberOfOutputs;
    }
}
