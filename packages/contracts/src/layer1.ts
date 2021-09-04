/* eslint-disable @typescript-eslint/no-explicit-any */
import Web3 from 'web3'
import Contract, { ContractOptions } from 'web3-eth-contract'
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
    const c = new (Contract as any)(abi, address, option)
    c.setProvider(web3.currentProvider)
    return c as IBurnAuction
  }

  static getIConsensusProvider(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IConsensusProvider {
    const abi: any[] = [...IConsensusProviderABI]
    const c = new (Contract as any)(abi, address, option)
    c.setProvider(web3.currentProvider)
    return c as IConsensusProvider
  }

  static getICoordinatable(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): ICoordinatable {
    const abi: any[] = [...ICoordinatableABI]
    const c = new (Contract as any)(abi, address, option)
    c.setProvider(web3.currentProvider)
    return c as ICoordinatable
  }

  static getIChallengeable(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IChallengeable {
    const abi: any[] = [...IChallengeableABI]
    const c = new (Contract as any)(abi, address, option)
    c.setProvider(web3.currentProvider)
    return c as IChallengeable
  }

  static getIDepositValidator(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IDepositValidator {
    const abi: any[] = [...IDepositValidatorABI]
    const c = new (Contract as any)(abi, address, option)
    c.setProvider(web3.currentProvider)
    return c as IDepositValidator
  }

  static getIHeaderValidator(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IHeaderValidator {
    const abi: any[] = [...IHeaderValidatorABI]
    const c = new (Contract as any)(abi, address, option)
    c.setProvider(web3.currentProvider)
    return c as IHeaderValidator
  }

  static getIMigratable(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IMigratable {
    const abi: any[] = [...IMigratableABI]
    const c = new (Contract as any)(abi, address, option)
    c.setProvider(web3.currentProvider)
    return c as IMigratable
  }

  static getIMigrationValidator(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IMigrationValidator {
    const abi: any[] = [...IMigrationValidatorABI]
    const c = new (Contract as any)(abi, address, option)
    c.setProvider(web3.currentProvider)
    return c as IMigrationValidator
  }

  static getIUtxoTreeValidator(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IUtxoTreeValidator {
    const abi: any[] = [...IUtxoTreeValidatorABI]
    const c = new (Contract as any)(abi, address, option)
    c.setProvider(web3.currentProvider)
    return c as IUtxoTreeValidator
  }

  static getIWithdrawalTreeValidator(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IWithdrawalTreeValidator {
    const abi: any[] = [...IWithdrawalTreeValidatorABI]
    const c = new (Contract as any)(abi, address, option)
    c.setProvider(web3.currentProvider)
    return c as IWithdrawalTreeValidator
  }

  static getINullifierTreeValidator(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): INullifierTreeValidator {
    const abi: any[] = [...INullifierTreeValidatorABI]
    const c = new (Contract as any)(abi, address, option)
    c.setProvider(web3.currentProvider)
    return c as INullifierTreeValidator
  }

  static getISetupWizard(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): ISetupWizard {
    const abi: any[] = [...ISetupWizardABI]
    const c = new (Contract as any)(abi, address, option)
    c.setProvider(web3.currentProvider)
    return c as ISetupWizard
  }

  static getITxValidator(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): ITxValidator {
    const abi: any[] = [...ITxValidatorABI]
    const c = new (Contract as any)(abi, address, option)
    c.setProvider(web3.currentProvider)
    return c as ITxValidator
  }

  static getIUserInteractable(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IUserInteractable {
    const abi: any[] = [...IUserInteractableABI]
    const c = new (Contract as any)(abi, address, option)
    c.setProvider(web3.currentProvider)
    return c as IUserInteractable
  }

  static getERC20(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): ERC20 {
    const abi: any[] = [...ERC20ABI]
    const c = new (Contract as any)(abi, address, option)
    c.setProvider(web3.currentProvider)
    return c as ERC20
  }

  static getERC721(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): ERC721 {
    const abi: any[] = [...ERC721ABI]
    const c = new (Contract as any)(abi, address, option)
    c.setProvider(web3.currentProvider)
    return c as ERC721
  }

  static getIERC721Enumerable(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IERC721Enumerable {
    const abi: any[] = [...IERC721EnumerableABI]
    const c = new (Contract as any)(abi, address, option)
    c.setProvider(web3.currentProvider)
    return c as IERC721Enumerable
  }

  static getZkopru(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): Zkopru {
    const abi: any[] = [...ZkopruABI]
    const c = new (Contract as any)(abi, address, option)
    c.setProvider(web3.currentProvider)
    return c as Zkopru
  }
}
