// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import { Layer2 } from "../../storage/Layer2.sol";
import { SMT254 } from "../../libraries/SMT.sol";
import {
    Block,
    Header,
    Transaction,
    Outflow,
    PublicData,
    AtomicSwap,
    Types
} from "../../libraries/Types.sol";
import { Deserializer } from "../../libraries/Deserializer.sol";
import { ITxValidator } from "../../interfaces/validators/ITxValidator.sol";

contract TxValidator is Layer2, ITxValidator {
    using Types for Header;
    using Types for Outflow;
    using Types for PublicData;

    /**
     * @dev Challenge when any of the used nullifier's inclusion reference is invalid.
     * @param // blockData Serialized block data
     * @param txIndex Index of the transaction in the tx list of the block body.
     * @param inflowIndex Index of the inflow note in the tx.
     */
    function validateInclusion(
        bytes calldata,
        uint256 txIndex,
        uint256 inflowIndex
    )
    external
    view
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        Transaction memory transaction = _block.body.txs[txIndex];
        uint256 ref = transaction.inflow[inflowIndex].inclusionRoot;
        return (
            !isValidRef(_block.header.hash(), ref),
            "Inclusion reference"
        );
    }

    /**
     * @dev Challenge when the submitted transaction has an invalid outflow
     * @param // blockData Serialized block data
     * @param txIndex Index of the transaction in the tx list of the block body.
     */
    function validateOutflow(
        bytes calldata, // blockData
        uint256 txIndex
    )
    external
    view
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        Transaction memory transaction = _block.body.txs[txIndex];
        for(uint256 i = 0; i < transaction.outflow.length; i++) {
            Outflow memory outflow = transaction.outflow[i];
            if (outflow.outflowType > 2) {
                return (true, "Invalid outflow type");
            }
            address tokenAddr = outflow.publicData.token;
            if(tokenAddr == address(0)) { // means UTXO
                if (!outflow.publicData.isEmpty()) {
                    return (true, "No public data");
                }
            } else {
                bool isERC20 = Layer2.chain.registeredERC20s[tokenAddr];
                bool isERC721 = Layer2.chain.registeredERC721s[tokenAddr];
                // means Withdrawal or migration. Inspect revealed token values
                if (!isERC20 && !isERC721) {
                    return (true, "Unregistered token address");
                } else if (isERC20 && 0 != outflow.publicData.nft) {
                    return (true, "ERC20 cannot have NFT");
                } else if (isERC721) {
                    if (outflow.publicData.amount != 0) {
                        return (true, "ERC721 cannot have amount value");
                    } else if (outflow.publicData.nft == 0) {
                        return (true, "Circuit does not support NFT id 0");
                    }
                }
            }
        }
    }

    /**
     * @dev Challenge when the submitted transaction does not follow correct atomic swap protocol
     * @param // blockData Serialized block data
     * @param txIndex Index of the transaction in the tx list of the block body.
     */
    function validateAtomicSwap(
        bytes calldata, // blockData
        uint256 txIndex
    )
    external
    view
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        uint256 swap = _block.body.txs[txIndex].swap;
        uint256 counterpart;
        for(uint256 i = 0; i < _block.body.txs.length; i++) {
            if(
                swap == _block.body.txs[i].swap &&
                i != txIndex
             ) {
                counterpart++;
             }
        }
        return (counterpart != 1, "allow only 1 counterpart tx");
    }

    /**
     * @dev Challenge when the block is trying to use an already used nullifier.
     * @param // blockData Serialized block data
     * @param // parentHeader  Serialized parent header data
     * @param txIndex Index of the transaction in the tx list of the block body.
     * @param inflowIndex Index of the inflow note in the tx.
     * @param sibling The sibling data of the nullifier.
     */
    function validateUsedNullifier(
        bytes calldata, // blockData
        bytes calldata, // parentHeader
        uint256 txIndex,
        uint256 inflowIndex,
        bytes32[254] calldata sibling
    )
    external
    view
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        Header memory _parentHeader = Deserializer.headerFromCalldataAt(1);
        bytes32 usedNullifier = _block.body.txs[txIndex].inflow[inflowIndex].nullifier;
        bytes32[] memory nullifiers = new bytes32[](1);
        bytes32[254][] memory siblings = new bytes32[254][](1);
        nullifiers[0] = usedNullifier;
        siblings[0] = sibling;
        bytes32 updatedRoot = SMT254.rollUp(
            _parentHeader.nullifierRoot,
            nullifiers,
            siblings
        );
        return (
            updatedRoot == _parentHeader.nullifierRoot, // should be updated if the nullifier wasn't used before.
            "Double spending"
        );
    }

    /**
     * @dev Challenge when a nullifier used twice in a same block.
     * @param // blockData Serialized block data
     * @param nullifier Double included nullifier.
     */
    function validateDuplicatedNullifier(
        bytes calldata, // blockData
        bytes32 nullifier
    )
    external
    view
    override
    returns (bool slash, string memory reason)
    {
        Block memory _block = Deserializer.blockFromCalldataAt(0);
        uint256 count = 0;
        for (uint256 i = 0; i < _block.body.txs.length; i++) {
            Transaction memory transaction = _block.body.txs[i];
            for (uint256 j = 0; j < transaction.inflow.length; j++) {
                // Found matched nullifier
                if (transaction.inflow[j].nullifier == nullifier) count++;
                if (count >= 2) break;
            }
            if (count >= 2) break;
        }
        return (count >= 2, "Duplicated nullifier");
    }

    /**
     * @notice It checks the validity of an inclusion refernce for a nullifier.
     * @dev Each nullifier should be paired with an inclusion reference which is a root of
     *      utxo tree. For the inclusion reference, You can use finalized roots or recent
     *      blocks' utxo roots. When you use recent blocks' utxo roots, recent REF_DEPTH
     *      of utxo roots are available. It costs maximum 1800*REF_DEPTH gas to validate
     *      an inclusion reference during the TX challenge process.
     * @param l2BlockHash Layer2 block's hash value where to start searching for.
     * @param ref Utxo root which includes the nullifier's origin utxo.
     */
    function isValidRef(bytes32 l2BlockHash, uint256 ref)
    public
    view
    override
    returns (bool)
    {
        if (Layer2.chain.finalizedUTXORoots[ref]) {
            return true;
        }
        bytes32 parentBlock = l2BlockHash;
        for (uint256 i = 0; i < REF_DEPTH; i++) {
            parentBlock = Layer2.chain.parentOf[parentBlock];
            if (Layer2.chain.utxoRootOf[parentBlock] == ref) {
                return true;
            }
        }
        return false;
    }
}
