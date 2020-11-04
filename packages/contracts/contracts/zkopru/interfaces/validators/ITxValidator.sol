// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

interface ITxValidator {
    function validateInclusion(bytes calldata blockData, uint256 txIndex, uint256 inflowIndex)
    external
    view
    returns (bool slash, string memory reason);

    function isValidRef(bytes32 l2BlockHash, uint256 ref) external view returns (bool);

    function validateOutflow(bytes calldata blockData, uint256 txIndex)
    external
    view
    returns (bool slash, string memory reason);

    function validateAtomicSwap(bytes calldata blockData, uint256 txIndex)
    external
    pure
    returns (bool slash, string memory reason);

    function validateUsedNullifier(bytes calldata blockData, bytes calldata parentHeader, uint256 txIndex, uint256 inflowIndex, bytes32[254] calldata sibling)
    external
    pure
    returns (bool slash, string memory reason);

    function validateDuplicatedNullifier(bytes calldata blockData, bytes32 nullifier)
    external
    pure
    returns (bool slash, string memory reason);

    function validateSNARK(bytes calldata blockData, uint256 txIndex)
    external
    view
    returns (bool slash, string memory reason);
}