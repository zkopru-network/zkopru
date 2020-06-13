pragma solidity >= 0.6.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { RollUpLib } from "../libraries/Tree.sol";
import { Layer2 } from "../storage/Layer2.sol";
import { Hash, Poseidon6, MiMC } from "../libraries/Hash.sol";
import { Withdrawable, Blockchain, Types } from "../libraries/Types.sol";

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
        uint eth,
        address token,
        uint amount,
        uint nft,
        uint fee,
        uint rootIndex,
        uint leafIndex,
        uint[] memory siblings
    ) public {
        _withdraw(msg.sender, eth, token, amount, nft, fee, rootIndex, leafIndex, siblings);
    }

    function withdrawUsingSignature(
        address to,
        uint eth,
        address token,
        uint amount,
        uint nft,
        uint fee,
        uint rootIndex,
        uint leafIndex,
        uint[] memory siblings,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        require(
            _verifyWithdrawalSignature(to, eth, token, amount, nft, fee, v, r, s),
            "Invalid signature"
        );
        _withdraw(to, eth, token, amount, nft, fee, rootIndex, leafIndex, siblings);
    }

    function _verifyWithdrawalSignature(
        address to,
        uint256 eth,
        address token,
        uint256 amount,
        uint256 nft,
        uint256 fee,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal pure returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(to, eth, token, amount, nft, fee));
        bytes32 prefixedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", leaf));
        address signer = ecrecover(prefixedHash, v, r, s);
        return signer == to;
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
        address to,
        uint eth,
        address token,
        uint256 amount,
        uint256 nft,
        uint256 fee,
        uint rootIndex,
        uint noteIndex,
        uint[] memory siblings
    ) internal {
        require(nft*amount == 0, "Only ERC20 or ERC721");
        bytes32 note = keccak256(abi.encodePacked(to, eth, token, amount, nft, fee));
        /// inclusion proof
        Withdrawable memory withdrawable = chain.withdrawables[rootIndex];
        bool inclusion = Hash.keccak().merkleProof(
            uint(withdrawable.root),
            uint(note),
            noteIndex,
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
        require(!Layer2.chain.withdrawn[note], "Already withdrawn");
        Layer2.chain.withdrawn[note] = true;
    }
}
