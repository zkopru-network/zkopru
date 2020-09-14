pragma solidity = 0.6.12;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { RollUpLib } from "../libraries/Tree.sol";
import { Layer2 } from "../storage/Layer2.sol";
import { Hash, Poseidon6 } from "../libraries/Hash.sol";
import { WithdrawalTree, Blockchain, Types } from "../libraries/Types.sol";

contract UserInteractable is Layer2 {
    uint256 public constant SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 public constant RANGE_LIMIT = SNARK_FIELD >> 32;
    using RollUpLib for *;

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
     * @notice Users can withdraw notes when only after they're finazlied.
     * @param note Note hash in layer 2. It is a poseidon hash
     * @param owner The original owner's address of the note
     * @param eth Amount of Ether to withdraw out
     * @param token Token address of ERC20 or ERC721. It can be undefined.
     * @param amount Amount of ERC20 when the token param is defined and it is an ERC20
     * @param nft NFT id when the token param is defined and it is an ERC721
     * @param fee Amount of fee to give to the coordinator
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
        uint256 fee,
        bytes32 blockHash,
        uint256 leafIndex,
        uint256[] memory siblings
    ) public {
        return _withdraw(
            note,
            owner,
            eth,
            token,
            amount,
            nft,
            fee,
            blockHash,
            leafIndex,
            siblings
        );
    }

    /**
     * @notice Someone can pay in advance for unfinalized withdrawals
     * @param note Poseidon note hash of the withdrawal
     * @param owner Address of the note
     * @param eth Amount of Ether to withdraw out
     * @param token Token address of ERC20 or ERC721. It can be undefined.
     * @param amount Amount of ERC20 when the token param is defined and it is an ERC20
     * @param nft NFT id when the token param is defined and it is an ERC721
     * @param fee Amount of fee to give to the coordinator
     * @param signature ECDSA signature
     */
    function payInAdvance(
        uint256 note,
        address owner,
        uint256 eth,
        address token,
        uint256 amount,
        uint256 nft,
        uint256 fee,
        bytes memory signature
    ) public payable {
        bytes32 withdrawalHash = _withdrawalHash(
            note,
            owner,
            eth,
            token,
            amount,
            nft,
            fee
        );
        require(!Layer2.chain.withdrawn[withdrawalHash], "Already withdrawn");

        address newOwner = Layer2.chain.newWithdrawalOwner[withdrawalHash];
        address currentOwner = newOwner == address(0) ? owner : newOwner;
        address prepayer = msg.sender;
        bytes32 payInAdvanceMsg = keccak256(
            abi.encodePacked(
                prepayer,
                withdrawalHash
            )
        );
        // verify original owner's signature
        require(
            _verifySignature(
                currentOwner,
                payInAdvanceMsg,
                signature
            ),
            "Invalid owner signature"
        );
        require(msg.value == eth, 'not enough ether');
        // prepay tokens
        if(amount!=0) {
            IERC20(token).transferFrom(prepayer, currentOwner, amount);
        } else {
            revert("Does not support NFT prepay");
        }
        // prepay ether
        payable(currentOwner).transfer(eth);
        // transfer ownership
        Layer2.chain.newWithdrawalOwner[withdrawalHash] = prepayer;
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
        require(msg.value < RANGE_LIMIT, "Too big value can cause the overflow inside the SNARK");
        require(amount < RANGE_LIMIT, "Too big value can cause the overflow inside the SNARK");
        require(nft < SNARK_FIELD, "Does not support too big nubmer of nft id");
        require(amount * nft == 0, "Only one of ERC20 or ERC721 exists");
        require(eth + fee == msg.value, "Inexact amount of eth");
        require(Layer2.chain.stagedSize < 1024, "Should wait until it is committed");

        //TODO: require(fee >= specified fee);
        // Validate the note is same with the hash result
        uint256[] memory assetHashInputs = new uint256[](4);
        assetHashInputs[0] = eth;
        assetHashInputs[1] = uint256(token);
        assetHashInputs[2] = amount; //erc20 amount
        assetHashInputs[3] = nft;
        uint256 assetHash = Poseidon6.poseidon(assetHashInputs);
        uint256[] memory resultHashInputs = new uint256[](3);
        resultHashInputs[0] = spendingPubKey;
        resultHashInputs[1] = salt;
        resultHashInputs[2] = assetHash;
        uint256 note = Poseidon6.poseidon(resultHashInputs);
        // Receive token
        if (token != address(0) && amount != 0) {
            try IERC20(token).transferFrom(msg.sender, address(this), amount) {
            } catch {
                revert("Transfer ERC20 failed");
            }
        } else if (token != address(0)) {
            try IERC721(token).transferFrom(msg.sender, address(this), nft) {
            } catch {
                revert("Transfer NFT failed");
            }
        }
        // Update the mass deposit
        Layer2.chain.stagedDeposits.merged = keccak256(abi.encodePacked(Layer2.chain.stagedDeposits.merged, note));
        Layer2.chain.stagedDeposits.fee += fee;
        Layer2.chain.stagedSize += 1;
        // Emit event. Coordinator should subscribe this event.
        emit Deposit(Layer2.chain.massDepositId, note, fee);
    }

    function _withdraw(
        uint256 note,
        address owner,
        uint256 eth,
        address token,
        uint256 amount,
        uint256 nft,
        uint256 fee,
        bytes32 blockHash,
        uint256 leafIndex,
        uint256[] memory siblings
    ) internal {
        require(nft*amount == 0, "Only ERC20 or ERC721");
        require(Layer2.chain.finalized[blockHash], "Not a finalized block");
        uint256 root = Layer2.chain.withdrawalRootOf[blockHash];
        bytes32 withdrawalHash = _withdrawalHash(
            note,
            owner,
            eth,
            token,
            amount,
            nft,
            fee
        );
        // Should not allow double-withdrawing
        require(!Layer2.chain.withdrawn[withdrawalHash], "Already withdrawn");
        // Check whether new owner exists
        address to = Layer2.chain.newWithdrawalOwner[withdrawalHash] != address(0)
            ? Layer2.chain.newWithdrawalOwner[withdrawalHash]
            : owner;

        // inclusion proof
        bool inclusion = Hash.keccak().merkleProof(
            root,
            uint256(withdrawalHash),
            leafIndex,
            siblings
        );
        require(inclusion, "The given withdrawal note does not exist");
        // Withdraw ETH & get fee
        if(eth != 0) {
            if(to == msg.sender) {
                payable(to).transfer(eth + fee);
            } else {
                payable(to).transfer(eth);
                payable(msg.sender).transfer(fee);
            }
        }
        // Withdrawn token
        if (token != address(0)) {
            if (amount != 0) {
                IERC20(token).transfer(to, amount);
            } else {
                IERC721(token).transferFrom(address(this), to, nft);
            }
        }
        // Mark as withdrawn
        Layer2.chain.withdrawn[withdrawalHash] = true;
    }

    function _withdrawalHash(
        uint256 note,
        address owner,
        uint256 eth,
        address token,
        uint256 amount,
        uint256 nft,
        uint256 fee
    ) internal pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                note,
                owner,
                eth,
                token,
                amount,
                nft,
                fee
            )
        );
    }

    function _verifySignature(
        address signer,
        bytes32 message,
        bytes memory sig
    ) internal pure returns (bool) {
        require(sig.length == 65);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            // first 32 bytes, after the length prefix.
            r := mload(add(sig, 32))
            // second 32 bytes.
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes).
            v := byte(0, mload(add(sig, 96)))
        }
        bytes32 prefixedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", message));
        return signer == ecrecover(prefixedHash, v, r, s);
    }
}
