/* eslint-disable @typescript-eslint/no-explicit-any */
import Web3 from 'web3'
import { ContractOptions } from 'web3-eth-contract'
import { ERC20 } from './contracts/ERC20'
import { ERC721 } from './contracts/ERC721'
import { IBurnAuction } from './contracts/IBurnAuction'
import { IChallengeable } from './contracts/IChallengeable'
import { IConsensusProvider } from './contracts/IConsensusProvider'
import { ICoordinatable } from './contracts/ICoordinatable'
import { IDepositValidator } from './contracts/IDepositValidator'
import { IERC721Enumerable } from './contracts/IERC721Enumerable'
import { IHeaderValidator } from './contracts/IHeaderValidator'
import { IMigratable } from './contracts/IMigratable'
import { IMigrationValidator } from './contracts/IMigrationValidator'
import { INullifierTreeValidator } from './contracts/INullifierTreeValidator'
import { ISetupWizard } from './contracts/ISetupWizard'
import { ITxValidator } from './contracts/ITxValidator'
import { IUserInteractable } from './contracts/IUserInteractable'
import { IUtxoTreeValidator } from './contracts/IUtxoTreeValidator'
import { IWithdrawalTreeValidator } from './contracts/IWithdrawalTreeValidator'
import { Zkopru } from './contracts/Zkopru'

import { ERC20ABI } from './abis/ERC20'
import { ERC721ABI } from './abis/ERC721'
import { IBurnAuctionABI } from './abis/IBurnAuction'
import { IChallengeableABI } from './abis/IChallengeable'
import { IConsensusProviderABI } from './abis/IConsensusProvider'
import { ICoordinatableABI } from './abis/ICoordinatable'
import { IDepositValidatorABI } from './abis/IDepositValidator'
import { IERC721EnumerableABI } from './abis/IERC721Enumerable'
import { IHeaderValidatorABI } from './abis/IHeaderValidator'
import { IMigratableABI } from './abis/IMigratable'
import { IMigrationValidatorABI } from './abis/IMigrationValidator'
import { INullifierTreeValidatorABI } from './abis/INullifierTreeValidator'
import { ISetupWizardABI } from './abis/ISetupWizard'
import { ITxValidatorABI } from './abis/ITxValidator'
import { IUserInteractableABI } from './abis/IUserInteractable'
import { IUtxoTreeValidatorABI } from './abis/IUtxoTreeValidator'
import { IWithdrawalTreeValidatorABI } from './abis/IWithdrawalTreeValidator'
import { ZkopruABI } from './abis/Zkopru'

export class Layer1 {
  static getIBurnAuction(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IBurnAuction {
    const abi: any[] = [...IBurnAuctionABI]
    return new web3.eth.Contract(abi, address, option) as IBurnAuction
  }

  static getIConsensusProvider(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IConsensusProvider {
    const abi: any[] = [...IConsensusProviderABI]
    return new web3.eth.Contract(abi, address, option) as IConsensusProvider
  }

  static getICoordinatable(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): ICoordinatable {
    const abi: any[] = [...ICoordinatableABI]
    return new web3.eth.Contract(abi, address, option) as ICoordinatable
  }

  static getIChallengeable(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IChallengeable {
    const abi: any[] = [...IChallengeableABI]
    return new web3.eth.Contract(abi, address, option) as IChallengeable
  }

  static getIDepositValidator(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IDepositValidator {
    const abi: any[] = [...IDepositValidatorABI]
    return new web3.eth.Contract(abi, address, option) as IDepositValidator
  }

  static getIHeaderValidator(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IHeaderValidator {
    const abi: any[] = [...IHeaderValidatorABI]
    return new web3.eth.Contract(abi, address, option) as IHeaderValidator
  }

  static getIMigratable(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IMigratable {
    const abi: any[] = [...IMigratableABI]
    return new web3.eth.Contract(abi, address, option) as IMigratable
  }

  static getIMigrationValidator(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IMigrationValidator {
    const abi: any[] = [...IMigrationValidatorABI]
    return new web3.eth.Contract(abi, address, option) as IMigrationValidator
  }

  static getIUtxoTreeValidator(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IUtxoTreeValidator {
    const abi: any[] = [...IUtxoTreeValidatorABI]
    return new web3.eth.Contract(abi, address, option) as IUtxoTreeValidator
  }

  static getIWithdrawalTreeValidator(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IWithdrawalTreeValidator {
    const abi: any[] = [...IWithdrawalTreeValidatorABI]
    return new web3.eth.Contract(
      abi,
      address,
      option,
    ) as IWithdrawalTreeValidator
  }

  static getINullifierTreeValidator(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): INullifierTreeValidator {
    const abi: any[] = [...INullifierTreeValidatorABI]
    return new web3.eth.Contract(
      abi,
      address,
      option,
    ) as INullifierTreeValidator
  }

  static getISetupWizard(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): ISetupWizard {
    const abi: any[] = [...ISetupWizardABI]
    return new web3.eth.Contract(abi, address, option) as ISetupWizard
  }

  static getITxValidator(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): ITxValidator {
    const abi: any[] = [...ITxValidatorABI]
    return new web3.eth.Contract(abi, address, option) as ITxValidator
  }

  static getIUserInteractable(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IUserInteractable {
    const abi: any[] = [...IUserInteractableABI]
    return new web3.eth.Contract(abi, address, option) as IUserInteractable
  }

  static getERC20(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): ERC20 {
    const abi: any[] = [...ERC20ABI]
    return new web3.eth.Contract(abi, address, option) as ERC20
  }

  static getERC721(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): ERC721 {
    const abi: any[] = [...ERC721ABI]
    return new web3.eth.Contract(abi, address, option) as ERC721
  }

  static getIERC721Enumerable(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IERC721Enumerable {
    const abi: any[] = [...IERC721EnumerableABI]
    return new web3.eth.Contract(abi, address, option) as IERC721Enumerable
  }

  static getZkopru(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): Zkopru {
    const abi: any[] = [...ZkopruABI]
    return new web3.eth.Contract(abi, address, option) as Zkopru
  }
}
