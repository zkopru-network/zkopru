// SPDX-License-Identifier: GPL-3.0-or-later
import { ECDSA } from "@openzeppelin/contracts/cryptography/ECDSA.sol";

pragma solidity =0.7.4;

struct EIP712Domain {
    string name;
    string version;
    uint256 chainId;
    address verifyingContract;
}

library EIP712 {
    using ECDSA for bytes32;

    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );

    function separator(string memory name, string memory version)
        internal
        view
        returns (bytes32)
    {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        return separator(EIP712Domain(name, version, chainId, address(this)));
    }

    function separator(EIP712Domain memory domain)
        internal
        pure
        returns (bytes32)
    {
        return
            keccak256(
                abi.encode(
                    EIP712_DOMAIN_TYPEHASH,
                    keccak256(bytes(domain.name)),
                    keccak256(bytes(domain.version)),
                    domain.chainId,
                    domain.verifyingContract
                )
            );
    }

    function recoverTypedSignV4(
        bytes32 domainSeparator,
        bytes32 structHash,
        bytes memory signature
    ) internal pure returns (address) {
        bytes32 typedMsg =
            keccak256(
                abi.encodePacked("\x19\x01", domainSeparator, structHash)
            );
        return typedMsg.recover(signature);
    }
}
