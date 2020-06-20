pragma solidity >= 0.6.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { RollUpLib } from "../libraries/Tree.sol";
import { Layer2 } from "../storage/Layer2.sol";
import { Hash, Poseidon6, MiMC } from "../libraries/Hash.sol";
import { WithdrawalTree, Blockchain, Types } from "../libraries/Types.sol";

contract UserInteractable is Layer2 {
    uint public constant SNARK_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint public constant RANGE_LIMIT = SNARK_FIELD >> 32;
    using RollUpLib for *;

    event Deposit(uint indexed queuedAt, uint note, uint fee);

    function deposit(
        uint eth,
        uint salt,
        address token,
        uint amount,
        uint nft,
        uint[2] memory pubKey,
        uint fee
    ) public payable {
        _deposit(eth, salt, token, amount, nft, pubKey, fee);
    }

    function withdraw(
        address owner,
        uint eth,
        address token,
        uint256 amount,
        uint256 nft,
        uint256 fee,
        bytes32 root,
        uint128 leafIndex,
        uint[] memory siblings
    ) internal {
        // find root
        bool rootExist = false;
        uint128 treeIndex;
        uint8 refIndex = Layer2.chain.wrIndex;
        for (uint i = 0; i < 256; i ++) {
            if (Layer2.chain.withdrawalRefs[refIndex] == root) {
                rootExist = true;
                break;
            }
            refIndex--;
        }
        require(rootExist, 'failed to find the withdrawal ref root');
        treeIndex = uint128(Layer2.chain.withdrawalTrees.length) - 1;
        if (treeIndex != 0 && Layer2.chain.withdrawalTrees[treeIndex - 1].root == root) {
            // found cached root indicates the latest archived tree's root.
            // set the tree index
            treeIndex = treeIndex - 1;
        }
        return _withdraw(
            owner,
            eth,
            token,
            amount,
            nft,
            fee,
            root,
            treeIndex,
            leafIndex,
            siblings
        );
    }

    function withdrawArchived(
        address owner,
        uint eth,
        address token,
        uint amount,
        uint nft,
        uint fee,
        uint128 treeIndex,
        uint128 leafIndex,
        uint[] memory siblings
    ) public {
        WithdrawalTree memory withdrawalTree = chain.withdrawalTrees[treeIndex];
        _withdraw(
            owner,
            eth,
            token,
            amount,
            nft,
            fee,
            withdrawalTree.root,
            treeIndex,
            leafIndex,
            siblings
        );
    }

    function payInAdvance(
        address owner,
        uint eth,
        address token,
        uint amount,
        uint nft,
        uint fee,
        uint128 treeIndex,
        uint128 leafIndex,
        bytes memory signature
    ) public payable {
        bytes32 withdrawalId = _withdrawalId(treeIndex, leafIndex);
        require(!Layer2.chain.withdrawn[withdrawalId], "Already withdrawn");

        bytes32 noteHash = keccak256(abi.encodePacked(owner, eth, token, amount, nft, fee));
        address newOwner = Layer2.chain.newWithdrawalOwner[withdrawalId][noteHash];
        address currentOwner = newOwner == address(0) ? owner : newOwner;
        address prepayer = msg.sender;
        bytes32 payInAdvanceMsg = keccak256(
            abi.encodePacked(
                prepayer,
                noteHash,
                withdrawalId
            )
        );
        /// verify original owner's signature
        require(
            _verifySignature(
                currentOwner,
                payInAdvanceMsg,
                signature
            ),
            "Invalid owner signature"
        );
        require(msg.value == eth, 'not enough ether');
        /// prepay tokens
        if(amount!=0) {
            IERC20(token).transferFrom(prepayer, currentOwner, amount);
        } else {
            revert("Does not support NFT prepay");
        }
        /// prepay ether
        payable(currentOwner).transfer(eth);
        /// transfer ownership
        Layer2.chain.newWithdrawalOwner[withdrawalId][noteHash] = prepayer;
    }

    function _deposit(
        uint eth,
        uint salt,
        address token,
        uint amount,
        uint nft,
        uint[2] memory pubKey,
        uint fee
    ) internal {
        require(msg.value < RANGE_LIMIT, "Too big value can cause the overflow inside the SNARK");
        require(amount < RANGE_LIMIT, "Too big value can cause the overflow inside the SNARK");
        require(nft < SNARK_FIELD, "Does not support too big nubmer of nft id");
        require(amount * nft == 0, "Only one of ERC20 or ERC721 exists");
        require(eth + fee == msg.value, "Inexact amount of eth");
        require(Layer2.chain.stagedSize < 1024, "Should wait until it is committed");

        ///TODO: require(fee >= specified fee);
        /// Validate the note is same with the hash result
        uint[] memory firstHashInputs = new uint[](4);
        firstHashInputs[0] = eth;
        firstHashInputs[1] = pubKey[0];
        firstHashInputs[2] = pubKey[1];
        firstHashInputs[3] = salt;
        uint firstHash = Poseidon6.poseidon(firstHashInputs);
        uint[] memory resultHashInputs = new uint[](4);
        resultHashInputs[0] = firstHash;
        resultHashInputs[1] = uint(token);
        resultHashInputs[2] = amount;
        resultHashInputs[3] = nft;
        uint note = Poseidon6.poseidon(resultHashInputs);
        /// Receive token
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
        /// Update the mass deposit
        Layer2.chain.stagedDeposits.merged = keccak256(abi.encodePacked(Layer2.chain.stagedDeposits.merged, note));
        Layer2.chain.stagedDeposits.fee += fee;
        Layer2.chain.stagedSize += 1;
        /// Emit event. Coordinator should subscribe this event.
        emit Deposit(Layer2.chain.massDepositId, note, fee);
    }

    function _withdraw(
        address owner,
        uint eth,
        address token,
        uint256 amount,
        uint256 nft,
        uint256 fee,
        bytes32 root,
        uint128 treeIndex,
        uint128 leafIndex,
        uint[] memory siblings
    ) internal {
        require(nft*amount == 0, "Only ERC20 or ERC721");
        bytes32 note = keccak256(abi.encodePacked(owner, eth, token, amount, nft, fee));
        bytes32 withdrawalId = _withdrawalId(treeIndex, leafIndex);
        // Should not be withdrawn
        require(!Layer2.chain.withdrawn[withdrawalId], "Already withdrawn");
        // Check whether new owner exists
        address to = Layer2.chain.newWithdrawalOwner[withdrawalId][note] != address(0)
            ? Layer2.chain.newWithdrawalOwner[withdrawalId][note]
            : owner;

        // inclusion proof
        bool inclusion = Hash.keccak().merkleProof(
            uint(root),
            uint(note),
            uint(leafIndex),
            siblings
        );
        require(inclusion, "The given withdrawal note does not exist");
        /// Withdraw ETH & get fee
        if(eth!=0) {
            if(to == msg.sender) {
                payable(to).transfer(eth + fee);
            } else {
                payable(to).transfer(eth);
                payable(msg.sender).transfer(fee);
            }
        }
        /// Withdrawn token
        if(amount!=0) {
            IERC20(token).transfer(to, amount);
        } else {
            IERC721(token).transferFrom(address(this), to, nft);
        }
        /// Mark as withdrawn
        Layer2.chain.withdrawn[withdrawalId] = true;
    }

    function _withdrawalId(uint128 treeIndex, uint128 leafIndex) internal pure returns (bytes32) {
        return abi.decode(abi.encodePacked(treeIndex, leafIndex), (bytes32));
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
