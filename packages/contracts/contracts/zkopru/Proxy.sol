// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity = 0.6.12;

import { Storage } from "./storage/Storage.sol";
import { IConfigurable } from "./interfaces/IConfigurable.sol";
import { ICoordinatable } from "./interfaces/ICoordinatable.sol";
import { IUserInteractable } from "./interfaces/IUserInteractable.sol";
import { IMigratable } from "./interfaces/IMigratable.sol";
import { IDepositValidator } from "./interfaces/validators/IDepositValidator.sol";
import { IHeaderValidator } from "./interfaces/validators/IHeaderValidator.sol";
import { IMigrationValidator } from "./interfaces/validators/IMigrationValidator.sol";
import { IUtxoTreeValidator } from "./interfaces/validators/IUtxoTreeValidator.sol";
import { IWithdrawalTreeValidator } from "./interfaces/validators/IWithdrawalTreeValidator.sol";
import { INullifierTreeValidator } from "./interfaces/validators/INullifierTreeValidator.sol";
import { ITxValidator } from "./interfaces/validators/ITxValidator.sol";

/* solium-disable */

contract Proxy is Storage {
    /**
     * @notice This proxies supports the following interfaces
     *          - ICoordinatable.sol
     *          - IUserInteractable.sol
     *          - IMigratable.sol
     *          - Challenges
     *              - IDepositChallenge.sol
     *              - IHeaderChallenge.sol
     *              - IMigrationChallenge.sol
     *              - IUtxoTreeChallenge.sol
     *              - IWithdrawalTreeChallenge.sol
     *              - INullifierTreeChallenge.sol
     *              - ITxChallenge.sol
     */
    fallback () external payable virtual {
        address addr = Storage.proxied[msg.sig];
        require(addr != address(0), "There is no proxy contract");
        (bool success, bytes memory result) = addr.delegatecall(msg.data);
        require(success, string(result));
    }

    /**
     * @dev See Coordinatable.sol's register() function
    */
    receive() external payable {
    }

    function _connectConfigurable(address addr) internal virtual {
        _connect(addr, IConfigurable(0).setMaxBlockSize.selector);
        _connect(addr, IConfigurable(0).setMaxValidationGas.selector);
        _connect(addr, IConfigurable(0).setChallengePeriod.selector);
        _connect(addr, IConfigurable(0).setMinimumStake.selector);
        _connect(addr, IConfigurable(0).setReferenceDepth.selector);
        _connect(addr, IConfigurable(0).setConsensusProvider.selector);
    }

    function _connectCoordinatable(address addr) internal {
        _connect(addr, ICoordinatable(0).register.selector);
        _connect(addr, ICoordinatable(0).stake.selector);
        _connect(addr, ICoordinatable(0).deregister.selector);
        _connect(addr, ICoordinatable(0).propose.selector);
        _connect(addr, ICoordinatable(0).finalize.selector);
        _connect(addr, ICoordinatable(0).commitMassDeposit.selector);
        _connect(addr, ICoordinatable(0).withdrawReward.selector);
        _connect(addr, ICoordinatable(0).isProposable.selector);
        _connect(addr, ICoordinatable(0).registerERC20.selector);
        _connect(addr, ICoordinatable(0).registerERC721.selector);
    }

    function _connectUserInteractable(address addr) internal {
        _connect(addr, IUserInteractable(0).deposit.selector);
        _connect(addr, IUserInteractable(0).withdraw.selector);
        _connect(addr, IUserInteractable(0).payInAdvance.selector);
    }

    function _connectMigratable(address addr) internal virtual {
        _connect(addr, IMigratable(0).migrateTo.selector);
    }

    function _connectChallengeable(
        address challengeable,
        address depositValidator,
        address headerValidator,
        address migrationValidator,
        address utxoTreeValidator,
        address withdrawalTreeValidator,
        address nullifierTreeValidator,
        address txValidator
    ) internal virtual {
        _connect(challengeable, IDepositValidator(0).validateMassDeposit.selector);
        _connect(challengeable, IHeaderValidator(0).validateDepositRoot.selector);
        _connect(challengeable, IHeaderValidator(0).validateTxRoot.selector);
        _connect(challengeable, IHeaderValidator(0).validateMigrationRoot.selector);
        _connect(challengeable, IHeaderValidator(0).validateTotalFee.selector);
        _connect(challengeable, IMigrationValidator(0).validateDuplicatedDestination.selector);
        _connect(challengeable, IMigrationValidator(0).validateTotalEth.selector);
        _connect(challengeable, IMigrationValidator(0).validateMergedLeaves.selector);
        _connect(challengeable, IMigrationValidator(0).validateMigrationFee.selector);
        _connect(challengeable, IMigrationValidator(0).validateDuplicatedERC20Migration.selector);
        _connect(challengeable, IMigrationValidator(0).validateERC20Amount.selector);
        _connect(challengeable, IMigrationValidator(0).validateDuplicatedERC721Migration.selector);
        _connect(challengeable, IMigrationValidator(0).validateNonFungibility.selector);
        _connect(challengeable, IMigrationValidator(0).validateNftExistence.selector);
        _connect(challengeable, IUtxoTreeValidator(0).validateUTXOIndex.selector);
        _connect(challengeable, IUtxoTreeValidator(0).validateUTXORoot.selector);
        _connect(challengeable, IWithdrawalTreeValidator(0).validateWithdrawalIndex.selector);
        _connect(challengeable, IWithdrawalTreeValidator(0).validateWithdrawalRoot.selector);
        _connect(challengeable, INullifierTreeValidator(0).validateNullifierRollUp.selector);
        _connect(challengeable, ITxValidator(0).validateInclusion.selector);
        _connect(challengeable, ITxValidator(0).validateOutflow.selector);
        _connect(challengeable, ITxValidator(0).validateAtomicSwap.selector);
        _connect(challengeable, ITxValidator(0).validateUsedNullifier.selector);
        _connect(challengeable, ITxValidator(0).validateDuplicatedNullifier.selector);
        _connect(challengeable, ITxValidator(0).isValidRef.selector);
        _connect(challengeable, ITxValidator(0).validateSNARK.selector);
        _connectValidator(depositValidator, IDepositValidator(0).validateMassDeposit.selector);
        _connectValidator(headerValidator, IHeaderValidator(0).validateDepositRoot.selector);
        _connectValidator(headerValidator, IHeaderValidator(0).validateTxRoot.selector);
        _connectValidator(headerValidator, IHeaderValidator(0).validateMigrationRoot.selector);
        _connectValidator(headerValidator, IHeaderValidator(0).validateTotalFee.selector);
        _connectValidator(migrationValidator, IMigrationValidator(0).validateDuplicatedDestination.selector);
        _connectValidator(migrationValidator, IMigrationValidator(0).validateTotalEth.selector);
        _connectValidator(migrationValidator, IMigrationValidator(0).validateMergedLeaves.selector);
        _connectValidator(migrationValidator, IMigrationValidator(0).validateMigrationFee.selector);
        _connectValidator(migrationValidator, IMigrationValidator(0).validateDuplicatedERC20Migration.selector);
        _connectValidator(migrationValidator, IMigrationValidator(0).validateERC20Amount.selector);
        _connectValidator(migrationValidator, IMigrationValidator(0).validateDuplicatedERC721Migration.selector);
        _connectValidator(migrationValidator, IMigrationValidator(0).validateNonFungibility.selector);
        _connectValidator(migrationValidator, IMigrationValidator(0).validateNftExistence.selector);
        _connectValidator(utxoTreeValidator, IUtxoTreeValidator(0).validateUTXOIndex.selector);
        _connectValidator(utxoTreeValidator, IUtxoTreeValidator(0).validateUTXORoot.selector);
        _connectValidator(withdrawalTreeValidator, IWithdrawalTreeValidator(0).validateWithdrawalIndex.selector);
        _connectValidator(withdrawalTreeValidator, IWithdrawalTreeValidator(0).validateWithdrawalRoot.selector);
        _connectValidator(nullifierTreeValidator, INullifierTreeValidator(0).validateNullifierRollUp.selector);
        _connectValidator(txValidator, ITxValidator(0).validateInclusion.selector);
        _connectValidator(txValidator, ITxValidator(0).validateOutflow.selector);
        _connectValidator(txValidator, ITxValidator(0).validateAtomicSwap.selector);
        _connectValidator(txValidator, ITxValidator(0).validateUsedNullifier.selector);
        _connectValidator(txValidator, ITxValidator(0).validateDuplicatedNullifier.selector);
        _connectValidator(txValidator, ITxValidator(0).isValidRef.selector);
        _connectValidator(txValidator, ITxValidator(0).validateSNARK.selector);
    }

    function _connect(address to, bytes4 sig) internal {
        proxied[sig] = to;
    }

    function _connectValidator(address to, bytes4 sig) internal {
        validators[sig] = to;
    }
}
