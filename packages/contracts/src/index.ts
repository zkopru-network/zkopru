/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable max-classes-per-file */

import Web3 from 'web3'
import { ContractOptions } from 'web3-eth-contract'

import { ICoordinatable } from './contracts/ICoordinatable'
import { IDepositChallenge } from './contracts/IDepositChallenge'
import { IERC20 } from './contracts/IERC20'
import { IERC721 } from './contracts/IERC721'
import { IERC721Enumerable } from './contracts/IERC721Enumerable'
import { IHeaderChallenge } from './contracts/IHeaderChallenge'
import { IMigratable } from './contracts/IMigratable'
import { IMigrationChallenge } from './contracts/IMigrationChallenge'
import { IRollUpChallenge } from './contracts/IRollUpChallenge'
import { IRollUpable } from './contracts/IRollUpable'
import { ISetupWizard } from './contracts/ISetupWizard'
import { ITxChallenge } from './contracts/ITxChallenge'
import { IUserInteractable } from './contracts/IUserInteractable'
import { ZkOptimisticRollUp } from './contracts/ZkOptimisticRollUp'

import { ICoordinatableABI } from './abis/ICoordinatable'
import { IDepositChallengeABI } from './abis/IDepositChallenge'
import { IERC20ABI } from './abis/IERC20'
import { IERC721ABI } from './abis/IERC721'
import { IERC721EnumerableABI } from './abis/IERC721Enumerable'
import { IHeaderChallengeABI } from './abis/IHeaderChallenge'
import { IMigratableABI } from './abis/IMigratable'
import { IMigrationChallengeABI } from './abis/IMigrationChallenge'
import { IRollUpChallengeABI } from './abis/IRollUpChallenge'
import { IRollUpableABI } from './abis/IRollUpable'
import { ISetupWizardABI } from './abis/ISetupWizard'
import { ITxChallengeABI } from './abis/ITxChallenge'
import { IUserInteractableABI } from './abis/IUserInteractable'
import { ZkOptimisticRollUpABI } from './abis/ZkOptimisticRollUp'

export default class ZkOPRUContract {
  upstream: ZkOptimisticRollUp

  coordinator: ICoordinatable

  user: IUserInteractable

  migrator: IMigratable

  challenger: {
    deposit: IDepositChallenge
    migration: IMigrationChallenge
    header: IHeaderChallenge
    tx: ITxChallenge
    rollUp: IRollUpChallenge
    rollUpProof: IRollUpable
  }

  setup: ISetupWizard

  constructor(web3: Web3, address: string, option?: ContractOptions) {
    this.upstream = ZkOPRUContract.asZkOptimisticRollUp(web3, address, option)
    this.coordinator = ZkOPRUContract.asICoordinatable(web3, address, option)
    this.user = ZkOPRUContract.asIUserInteractable(web3, address, option)
    this.migrator = ZkOPRUContract.asIMigratable(web3, address, option)
    this.challenger = {
      deposit: ZkOPRUContract.asIDepositChallenge(web3, address, option),
      migration: ZkOPRUContract.asIMigrationChallenge(web3, address, option),
      header: ZkOPRUContract.asIHeaderChallenge(web3, address, option),
      tx: ZkOPRUContract.asITxChallenge(web3, address, option),
      rollUp: ZkOPRUContract.asIRollUpChallenge(web3, address, option),
      rollUpProof: ZkOPRUContract.asIRollUpable(web3, address, option),
    }
    this.setup = ZkOPRUContract.asISetupWizard(web3, address, option)
  }

  static asICoordinatable(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): ICoordinatable {
    const abi: any[] = [...ICoordinatableABI]
    return new web3.eth.Contract(abi, address, option) as ICoordinatable
  }

  static asIDepositChallenge(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IDepositChallenge {
    const abi: any[] = [...IDepositChallengeABI]
    return new web3.eth.Contract(abi, address, option) as IDepositChallenge
  }

  static asIHeaderChallenge(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IHeaderChallenge {
    const abi: any[] = [...IHeaderChallengeABI]
    return new web3.eth.Contract(abi, address, option) as IHeaderChallenge
  }

  static asIMigratable(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IMigratable {
    const abi: any[] = [...IMigratableABI]
    return new web3.eth.Contract(abi, address, option) as IMigratable
  }

  static asIMigrationChallenge(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IMigrationChallenge {
    const abi: any[] = [...IMigrationChallengeABI]
    return new web3.eth.Contract(abi, address, option) as IMigrationChallenge
  }

  static asIRollUpChallenge(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IRollUpChallenge {
    const abi: any[] = [...IRollUpChallengeABI]
    return new web3.eth.Contract(abi, address, option) as IRollUpChallenge
  }

  static asIRollUpable(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IRollUpable {
    const abi: any[] = [...IRollUpableABI]
    return new web3.eth.Contract(abi, address, option) as IRollUpable
  }

  static asISetupWizard(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): ISetupWizard {
    const abi: any[] = [...ISetupWizardABI]
    return new web3.eth.Contract(abi, address, option) as ISetupWizard
  }

  static asITxChallenge(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): ITxChallenge {
    const abi: any[] = [...ITxChallengeABI]
    return new web3.eth.Contract(abi, address, option) as ITxChallenge
  }

  static asIUserInteractable(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IUserInteractable {
    const abi: any[] = [...IUserInteractableABI]
    return new web3.eth.Contract(abi, address, option) as IUserInteractable
  }

  static asIERC20(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IERC20 {
    const abi: any[] = [...IERC20ABI]
    return new web3.eth.Contract(abi, address, option) as IERC20
  }

  static asIERC721(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IERC721 {
    const abi: any[] = [...IERC721ABI]
    return new web3.eth.Contract(abi, address, option) as IERC721
  }

  static asIERC721Enumerable(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IERC721Enumerable {
    const abi: any[] = [...IERC721EnumerableABI]
    return new web3.eth.Contract(abi, address, option) as IERC721Enumerable
  }

  static asZkOptimisticRollUp(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): ZkOptimisticRollUp {
    const abi: any[] = [...ZkOptimisticRollUpABI]
    return new web3.eth.Contract(abi, address, option) as ZkOptimisticRollUp
  }
}
