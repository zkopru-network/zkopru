/* eslint-disable @typescript-eslint/no-explicit-any */
import Web3 from 'web3'
import { ContractOptions } from 'web3-eth-contract'
import { ERC20 } from './contracts/ERC20'
import { ERC721 } from './contracts/ERC721'
import { ICoordinatable } from './contracts/ICoordinatable'
import { IDepositChallenge } from './contracts/IDepositChallenge'
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

import { ERC20ABI } from './abis/ERC20'
import { ERC721ABI } from './abis/ERC721'
import { ICoordinatableABI } from './abis/ICoordinatable'
import { IDepositChallengeABI } from './abis/IDepositChallenge'
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

export class Layer1 {
  static getICoordinatable(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): ICoordinatable {
    const abi: any[] = [...ICoordinatableABI]
    return new web3.eth.Contract(abi, address, option) as ICoordinatable
  }

  static getIDepositChallenge(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IDepositChallenge {
    const abi: any[] = [...IDepositChallengeABI]
    return new web3.eth.Contract(abi, address, option) as IDepositChallenge
  }

  static getIHeaderChallenge(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IHeaderChallenge {
    const abi: any[] = [...IHeaderChallengeABI]
    return new web3.eth.Contract(abi, address, option) as IHeaderChallenge
  }

  static getIMigratable(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IMigratable {
    const abi: any[] = [...IMigratableABI]
    return new web3.eth.Contract(abi, address, option) as IMigratable
  }

  static getIMigrationChallenge(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IMigrationChallenge {
    const abi: any[] = [...IMigrationChallengeABI]
    return new web3.eth.Contract(abi, address, option) as IMigrationChallenge
  }

  static getIRollUpChallenge(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IRollUpChallenge {
    const abi: any[] = [...IRollUpChallengeABI]
    return new web3.eth.Contract(abi, address, option) as IRollUpChallenge
  }

  static getIRollUpable(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): IRollUpable {
    const abi: any[] = [...IRollUpableABI]
    return new web3.eth.Contract(abi, address, option) as IRollUpable
  }

  static getISetupWizard(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): ISetupWizard {
    const abi: any[] = [...ISetupWizardABI]
    return new web3.eth.Contract(abi, address, option) as ISetupWizard
  }

  static getITxChallenge(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): ITxChallenge {
    const abi: any[] = [...ITxChallengeABI]
    return new web3.eth.Contract(abi, address, option) as ITxChallenge
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

  static getZkOptimisticRollUp(
    web3: Web3,
    address: string,
    option?: ContractOptions,
  ): ZkOptimisticRollUp {
    const abi: any[] = [...ZkOptimisticRollUpABI]
    return new web3.eth.Contract(abi, address, option) as ZkOptimisticRollUp
  }
}
