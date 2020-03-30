pragma solidity >= 0.6.0;

import { Pairing } from "./Pairing.sol";

struct Blockchain {
    bytes32 latest;
    /** For inclusion reference */
    mapping(bytes32=>bytes32) parentOf; // childBlockHash=>parentBlockHash
    mapping(bytes32=>uint256) utxoRootOf; // header => utxoRoot
    mapping(uint256=>bool) finalizedUTXOs; // all finalized utxoRoots
    /** For coordinating */
    mapping(address=>Proposer) proposers;
    mapping(bytes32=>Proposal) proposals;
    /** For deposit */
    MassDeposit stagedDeposits;
    uint stagedSize;
    uint massDepositId;
    mapping(bytes32=>uint) committedDeposits;

    /** For withdrawal */
    Withdrawable[] withdrawables; /// 0: daily snapshot of the latest withdrawable tree
    uint256 snapshotTimestamp;
    mapping(bytes32=>bool) withdrawn;
    /** For migrations */
    mapping(bytes32=>bool) migrations;
    // MassMigration[] migrations; // legacy
}

struct MassDeposit {
    bytes32 merged;
    uint256 fee;
}

/// needs gas limit
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

struct Withdrawable {
    /// Merkle tree of Withdrawable notes
    bytes32 root;
    uint index;
}

struct Finalization {
    bytes32 submissionId;
    Header header;
    MassDeposit[] massDeposits;
    MassMigration[] massMigrations;
}

struct Proposer {
    uint stake;
    uint reward;
    uint exitAllowance;
}

struct Proposal {
    bytes32 headerHash;
    uint challengeDue;
    bool slashed;
}

struct Challenge {
    bool slash;
    bytes32 proposalId;
    address proposer;
    string message;
}

struct Block {
    bytes32 submissionId;
    Header header;
    Body body;
}

struct Header {
    /** Basic data */
    address proposer;
    bytes32 parentBlock;
    bytes32 metadata;
    uint256 fee;

    /** UTXO roll up  */
    uint256 prevUTXORoot;
    uint256 prevUTXOIndex;
    uint256 nextUTXORoot;
    uint256 nextUTXOIndex;

    /** Nullifier roll up  */
    bytes32 prevNullifierRoot;
    bytes32 nextNullifierRoot;

    /** Withdrawal roll up  */
    bytes32 prevWithdrawalRoot;
    uint256 prevWithdrawalIndex;
    bytes32 nextWithdrawalRoot;
    uint256 nextWithdrawalIndex;

    /** Transactions */
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

/// Only used for migration
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
    Pairing.G1Point a;
    Pairing.G2Point b;
    Pairing.G1Point c;
}

library Types {
    function init(Blockchain storage chain, bytes32 genesis) internal {
        chain.latest = genesis;
        chain.withdrawables.push(); /// withdrawables[0]: daily snapshot
        chain.withdrawables.push(); /// withdrawables[0]: initial withdrawable tree
    }

    function hash(Header memory header) internal pure returns (bytes32) {
        /** This commented out code can't be compiled because the stack is too deep.
        return keccak256(
            abi.encodePacked(
                header.proposer,
                header.parentBlock,
                header.metadata,
                header.fee,
                header.prevUTXORoot,
                header.prevUTXOIndex,
                header.nextUTXORoot,
                header.nextUTXOIndex,
                header.prevNullifierRoot,
                header.nextNullifierRoot,
                header.prevWithdrawalRoot,
                header.prevWithdrawalIndex,
                header.nextWithdrawalRoot,
                header.nextWithdrawalIndex,
                header.txRoot,
                header.depositRoot,
                header.migrationRoot
            )
        );
        */
        bytes32 headerHash;
        uint LEN = 20 + 16 * 32;
        assembly {
            // Skip the padding bytes for the proposer address
            headerHash := keccak256(add(header, 0x0c), LEN)
        }
        return headerHash;
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
        for(uint i = 0; i < inflow.length; i++) {
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
        for(uint i = 0; i < outflow.length; i++) {
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
        return abi.encodePacked(proof.a.X, proof.a.Y, proof.b.X, proof.b.Y, proof.c.X, proof.c.Y);
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
        for(uint i = 0; i < massMigration.erc20.length; i++) {
            packed = abi.encodePacked(
                packed,
                massMigration.erc20[i].addr,
                massMigration.erc20[i].amount
            );
        }
        for(uint i = 0; i < massMigration.erc20.length; i++) {
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
        for(uint i = 0; i < transactions.length; i++) {
            leaves[i] = hash(transactions[i]);
        }
        return root(leaves);
    }

    function root(MassDeposit[] memory massDeposits) internal pure returns (bytes32) {
        bytes32[] memory leaves = new bytes32[](massDeposits.length);
        for(uint i = 0; i < massDeposits.length; i++) {
            leaves[i] = hash(massDeposits[i]);
        }
        return root(leaves);
    }

    function root(MassMigration[] memory massMigrations) internal pure returns (bytes32) {
        bytes32[] memory leaves = new bytes32[](massMigrations.length);
        for(uint i = 0; i < massMigrations.length; i++) {
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

        for (uint i = 0; i < nodes.length; i++) {
            if(hasEmptyLeaf && i == nodes.length - 1) {
                nodes[i] = keccak256(abi.encodePacked(leaves[i*2], bytes32(0)));
            } else {
                nodes[i] = keccak256(abi.encodePacked(leaves[i*2], leaves[i*2+1]));
            }
        }
        return root(nodes);
    }

    function root(uint[] memory leaves) internal pure returns (bytes32) {
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
    function maxChallengeCost(Block memory submission) internal pure returns (uint256 maxCost) {
    }

    function getSNARKsSignature(
        uint8 numberOfInputs,
        uint8 numberOfOutputs
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(numberOfInputs, numberOfOutputs));
    }
}
