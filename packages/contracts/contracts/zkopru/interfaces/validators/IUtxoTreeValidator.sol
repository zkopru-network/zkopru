// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.7.4;

interface IUtxoTreeValidator {
    function newProof(
        uint256 proofId,
        uint256 startingRoot,
        uint256 startingIndex,
        uint256[] memory initialSiblings
    ) external;

    function updateProof(uint256 proofId, uint256[] memory leaves) external;

    function validateUTXOIndex(
        bytes calldata blockData,
        bytes calldata parentHeader,
        uint256[] calldata deposits
    ) external pure returns (bool slash, string memory reason);

    function validateUTXORoot(
        bytes calldata blockData,
        bytes calldata parentHeader,
        uint256[] calldata deposits,
        uint256[] calldata initialSiblings
    ) external pure returns (bool slash, string memory reason);

    function validateUTXORootWithProof(
        bytes calldata blockData,
        bytes calldata parentHeader,
        uint256[] calldata _deposits,
        uint256 proofId
    ) external view returns (bool slash, string memory reason);

    function getProof(uint256 proofId)
        external
        view
        returns (
            address owner,
            uint256 startRoot,
            uint256 startIndex,
            uint256 resultRoot,
            uint256 resultIndex,
            bytes32 mergedLeaves,
            uint256[] memory cachedSiblings
        );
}
