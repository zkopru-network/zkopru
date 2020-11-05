// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

interface IHeaderValidator {
    function validateDepositRoot(bytes calldata blockData)
    external
    pure
    returns (bool slash, string memory reason);

    function validateTxRoot(bytes calldata blockData)
    external
    pure
    returns (bool slash, string memory reason);

    function validateMigrationRoot(bytes calldata blockData)
    external
    pure
    returns (bool slash, string memory reason);

    function validateTotalFee(bytes calldata blockData)
    external
    pure
    returns (bool slash, string memory reason);

    function validateParentBlock(bytes calldata blockData)
    external
    view
    returns (bool slash, string memory reason);
}