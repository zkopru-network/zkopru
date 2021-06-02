// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.7.4;
pragma experimental ABIEncoderV2;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { EIP712, EIP712Domain } from "../libraries/EIP712.sol";
import { MerkleTreeLib } from "../libraries/MerkleTree.sol";
import { Storage } from "../storage/Storage.sol";
import { Hash, Poseidon3, Poseidon4 } from "../libraries/Hash.sol";
import {
    WithdrawalTree,
    Blockchain,
    PublicData,
    Types
} from "../libraries/Types.sol";
import { PrepayRequest } from "../interfaces/IUserInteractable.sol";

contract UserInteractable is Storage {
    uint256 public constant SNARK_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 public constant RANGE_LIMIT = SNARK_FIELD >> 32;
    bytes32 private constant PREPAY_TYPEHASH =
        keccak256(
            "PrepayRequest(address prepayer,bytes32 withdrawalHash,uint256 prepayFeeInEth,uint256 prepayFeeInToken,uint256 expiration)"
        );

    using MerkleTreeLib for *;
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using EIP712 for bytes32;
    using EIP712 for EIP712Domain;

    event Deposit(uint256 indexed queuedAt, uint256 note, uint256 fee);

    /**
     * @notice Users can use zkopru network by submitting a new homomorphically hiden note.
     * @param spendingPubKey P = poseidon(p*G, N) https://github.com/zkopru-network/zkopru/issues/34#issuecomment-666988505
     * @param salt 254bit salt for the privacy
     * @param eth Amount of Ether to deposit
     * @param token Token address of ERC20 or ERC721. It can be undefined.
     * @param amount Amount of ERC20 when the token param is defined and it is an ERC20
     * @param nft NFT id when the token param is defined and it is an ERC721
     * @param fee Amount of fee to give to the coordinator
     */
    function deposit(
        uint256 spendingPubKey,
        uint256 salt,
        uint256 eth,
        address token,
        uint256 amount,
        uint256 nft,
        uint256 fee
    ) public payable {
        _deposit(spendingPubKey, salt, eth, token, amount, nft, fee);
    }

    /**
     * @notice IERC721Receiver implementation. Adds support for safeTransfer.
     **/
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4) {
        return this.onERC721Received.selector;
    }

    /**
     * @notice Users can withdraw notes when only after they're finazlied.
     * @param note Note hash in layer 2. It is a poseidon hash
     * @param owner The original owner's address of the note
     * @param eth Amount of Ether to withdraw out
     * @param token Token address of ERC20 or ERC721. It can be undefined.
     * @param amount Amount of ERC20 when the token param is defined and it is an ERC20
     * @param nft NFT id when the token param is defined and it is an ERC721
     * @param callerFee Amount of fee to give to the caller. This can be used when the withdrawer account has no ETH.
     * @param blockHash Finalized block hash to find the finalized withdrawal root
     * @param leafIndex The index of your withdrawal note's leaf in the given tree.
     * @param siblings Inclusion proof data
     */
    function withdraw(
        uint256 note,
        address owner,
        uint256 eth,
        address token,
        uint256 amount,
        uint256 nft,
        uint256 callerFee,
        bytes32 blockHash,
        uint256 leafIndex,
        uint256[] memory siblings
    ) public {
        return
            _withdraw(
                note,
                owner,
                eth,
                token,
                amount,
                nft,
                callerFee,
                blockHash,
                leafIndex,
                siblings
            );
    }

    /**
     * @notice Someone can pay in advance for unfinalized withdrawals
     * @param note Poseidon note hash of the withdrawal
     * @param publicData Public Data from its outflow
     * @param prepayRequest Prepay request data for the signature
     * @param signature ECDSA signature
     */
    function payInAdvance(
        uint256 note,
        PublicData memory publicData,
        PrepayRequest memory prepayRequest,
        bytes memory signature
    ) public payable {
        require(
            block.timestamp < prepayRequest.expiration,
            "Signature expired"
        );
        bytes32 withdrawalHash =
            _withdrawalHash(
                note,
                publicData.to,
                publicData.eth,
                publicData.token,
                publicData.amount,
                publicData.nft,
                publicData.fee
            );
        require(!Storage.chain.withdrawn[withdrawalHash], "Already withdrawn");
        require(
            prepayRequest.withdrawalHash == withdrawalHash,
            "Prepay data is different with the given withdrawal note."
        );
        require(
            prepayRequest.prepayer == msg.sender,
            "This tx should be from the prepayer."
        );

        address currentOwner =
            Storage.chain.newWithdrawalOwner[withdrawalHash] != address(0)
                ? Storage.chain.newWithdrawalOwner[withdrawalHash]
                : publicData.to;
        address prepayer = msg.sender;

        // verify original owner's signature
        bytes32 structHash =
            keccak256(
                abi.encode(
                    PREPAY_TYPEHASH,
                    prepayRequest.prepayer,
                    prepayRequest.withdrawalHash,
                    prepayRequest.prepayFeeInEth,
                    prepayRequest.prepayFeeInToken,
                    prepayRequest.expiration
                )
            );
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        require(
            currentOwner ==
                EIP712.separator("Zkopru", "1").recoverTypedSignV4(
                    structHash,
                    signature
                ),
            "Invalid owner signature"
        );
        // transfer ownership
        Storage.chain.newWithdrawalOwner[withdrawalHash] = prepayer;
        // transfer assets
        require(msg.value == publicData.eth, "not enough ether");
        // prepay tokens
        if (Storage.chain.registeredERC20s[publicData.token]) {
            IERC20(publicData.token).safeTransferFrom(
                prepayer,
                currentOwner,
                publicData.amount.sub(prepayRequest.prepayFeeInToken)
            );
        } else if (Storage.chain.registeredERC721s[publicData.token]) {
            revert("Does not support NFT prepay");
        }
        // prepay ether
        _sendEth(
            currentOwner,
            publicData.eth.sub(prepayRequest.prepayFeeInEth)
        );
    }

    function _deposit(
        uint256 spendingPubKey,
        uint256 salt,
        uint256 eth,
        address token,
        uint256 amount,
        uint256 nft,
        uint256 fee
    ) internal {
        // range check
        require(
            amount < RANGE_LIMIT,
            "Too big value can cause the overflow inside the SNARK"
        );
        require(
            eth < RANGE_LIMIT,
            "Too big value can cause the overflow inside the SNARK"
        );
        require(
            fee < RANGE_LIMIT,
            "Too big value can cause the overflow inside the SNARK"
        );
        require(nft < SNARK_FIELD, "Does not support too big nubmer of nft id");
        // check eth value
        require(eth.add(fee) == msg.value, "Inexact amount of eth");
        require(
            Storage.chain.stagedSize < 1024,
            "Should wait until it is committed"
        );
        // check note fields
        require(_checkNoteFields(eth, token, amount, nft));

        // Validate the note is same with the hash result
        uint256[4] memory assetHashInputs = [eth, uint256(token), amount, nft];
        uint256 assetHash = Poseidon4.poseidon(assetHashInputs);
        uint256[3] memory resultHashInputs = [spendingPubKey, salt, assetHash];
        uint256 note = Poseidon3.poseidon(resultHashInputs);
        // Receive token
        if (token != address(0)) {
            if (chain.registeredERC20s[token]) {
                IERC20(token).safeTransferFrom(
                    msg.sender,
                    address(this),
                    amount
                );
            } else if (chain.registeredERC721s[token]) {
                IERC721(token).safeTransferFrom(msg.sender, address(this), nft);
            } else {
                revert("Not a registered token.");
            }
        }
        // Update the mass deposit
        Storage.chain.stagedDeposits.merged = keccak256(
            abi.encodePacked(Storage.chain.stagedDeposits.merged, note)
        );
        Storage.chain.stagedDeposits.fee = Storage.chain.stagedDeposits.fee.add(
            fee
        );
        Storage.chain.stagedSize = Storage.chain.stagedSize.add(1);
        // Emit event. Coordinator should subscribe this event.
        emit Deposit(Storage.chain.massDepositId, note, fee);
    }

    function _withdraw(
        uint256 note,
        address owner,
        uint256 eth,
        address token,
        uint256 amount,
        uint256 nft,
        uint256 callerFee,
        bytes32 blockHash,
        uint256 leafIndex,
        uint256[] memory siblings
    ) internal {
        // range check
        require(
            amount < RANGE_LIMIT,
            "Too big value can cause the overflow inside the SNARK"
        );
        require(
            eth < RANGE_LIMIT,
            "Too big value can cause the overflow inside the SNARK"
        );
        require(
            callerFee < RANGE_LIMIT,
            "Too big value can cause the overflow inside the SNARK"
        );
        require(nft < SNARK_FIELD, "Does not support too big nubmer of nft id");
        // check note fields
        require(_checkNoteFields(eth, token, amount, nft));
        // check the reference block is finalized
        require(Storage.chain.finalized[blockHash], "Not a finalized block");
        uint256 root = Storage.chain.withdrawalRootOf[blockHash];
        bytes32 withdrawalHash =
            _withdrawalHash(note, owner, eth, token, amount, nft, callerFee);
        // Should not allow double-withdrawing
        require(!Storage.chain.withdrawn[withdrawalHash], "Already withdrawn");
        // Mark as withdrawn
        Storage.chain.withdrawn[withdrawalHash] = true;
        // Check whether new owner exists
        address to =
            Storage.chain.newWithdrawalOwner[withdrawalHash] != address(0)
                ? Storage.chain.newWithdrawalOwner[withdrawalHash]
                : owner;

        // inclusion proof
        bool inclusion =
            Hash.keccak().merkleProof(
                root,
                uint256(withdrawalHash),
                leafIndex,
                siblings
            );
        require(inclusion, "The given withdrawal note does not exist");
        // Withdraw ETH & get fee
        if (to == msg.sender) {
            _sendEth(to, eth.add(callerFee));
        } else {
            _sendEth(to, eth);
            _sendEth(msg.sender, callerFee);
        }
        // Withdraw tokens if exists
        if (Storage.chain.registeredERC20s[token]) {
            IERC20(token).safeTransfer(to, amount);
        } else if (Storage.chain.registeredERC721s[token]) {
            IERC721(token).safeTransferFrom(address(this), to, nft);
        }
    }

    function _withdrawalHash(
        uint256 note,
        address owner,
        uint256 eth,
        address token,
        uint256 amount,
        uint256 nft,
        uint256 callerFee
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    note,
                    owner,
                    eth,
                    token,
                    amount,
                    nft,
                    callerFee
                )
            );
    }

    function _checkNoteFields(
        uint256 eth,
        address token,
        uint256 amount,
        uint256 nft
    ) internal view returns (bool) {
        if (token == address(0)) {
            require(
                nft == 0 && amount == 0,
                "Ether note does not have amount field & nft field"
            );
            require(eth != 0, "Should have ETH field");
        } else {
            // this note contains token value
            bool isERC20 = Storage.chain.registeredERC20s[token];
            bool isERC721 = Storage.chain.registeredERC721s[token];
            require(
                isERC20 || isERC721,
                "Not a registered token. Reigster that token first"
            );
            if (isERC20) {
                require(nft == 0, "ERC20 does have NFT field");
            } else if (isERC721) {
                require(
                    nft != 0,
                    "Circuit cannot accept NFT id 0. Please deposit other NFT."
                );
                require(amount == 0, "ERC721 does have amount field");
            }
        }
        return true;
    }

    function _sendEth(address to, uint256 val) internal {
        if (val > 0) {
            (bool success, ) = to.call{ value: val }("");
            require(success, "Failed to send ETH");
        }
    }
}
