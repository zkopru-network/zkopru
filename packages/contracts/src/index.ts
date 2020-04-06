/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable max-classes-per-file */

import Web3 from 'web3'
import { ContractOptions } from 'web3-eth-contract'
import { Challengeable } from './contracts/Challengeable'
import { Configurated } from './contracts/Configurated'
import { Coordinatable } from './contracts/Coordinatable'
import { DepositChallenge } from './contracts/DepositChallenge'
import { DeserializationTester } from './contracts/DeserializationTester'
import { HeaderChallenge } from './contracts/HeaderChallenge'
import { ICoordinatable } from './contracts/ICoordinatable'
import { IDepositChallenge } from './contracts/IDepositChallenge'
import { IERC20 } from './contracts/IERC20'
import { IERC721 } from './contracts/IERC721'
import { IHeaderChallenge } from './contracts/IHeaderChallenge'
import { IMigratable } from './contracts/IMigratable'
import { IMigrationChallenge } from './contracts/IMigrationChallenge'
import { IRollUpChallenge } from './contracts/IRollUpChallenge'
import { IRollUpable } from './contracts/IRollUpable'
import { ISetupWizard } from './contracts/ISetupWizard'
import { ITxChallenge } from './contracts/ITxChallenge'
import { IUserInteractable } from './contracts/IUserInteractable'
import { Layer2 } from './contracts/Layer2'
import { Layer2Controller } from './contracts/Layer2Controller'
import { MiMC } from './contracts/MiMC'
import { Migratable } from './contracts/Migratable'
import { MigrationChallenge } from './contracts/MigrationChallenge'
import { Migrations } from './contracts/Migrations'
import { Poseidon } from './contracts/Poseidon'
import { RollUpChallenge } from './contracts/RollUpChallenge'
import { RollUpable } from './contracts/RollUpable'
import { SMT256 } from './contracts/SMT256'
import { SetupWizard } from './contracts/SetupWizard'
import { TestERC20 } from './contracts/TestERC20'
import { TxChallenge } from './contracts/TxChallenge'
import { UserInteractable } from './contracts/UserInteractable'
import { ZkOptimisticRollUp } from './contracts/ZkOptimisticRollUp'
import { ChallengeableABI } from './abis/Challengeable'
import { ConfiguratedABI } from './abis/Configurated'
import { CoordinatableABI } from './abis/Coordinatable'
import { DepositChallengeABI } from './abis/DepositChallenge'
import { DeserializationTesterABI } from './abis/DeserializationTester'
import { HeaderChallengeABI } from './abis/HeaderChallenge'
import { ICoordinatableABI } from './abis/ICoordinatable'
import { IDepositChallengeABI } from './abis/IDepositChallenge'
import { IERC20ABI } from './abis/IERC20'
import { IERC721ABI } from './abis/IERC721'
import { IHeaderChallengeABI } from './abis/IHeaderChallenge'
import { IMigratableABI } from './abis/IMigratable'
import { IMigrationChallengeABI } from './abis/IMigrationChallenge'
import { IRollUpChallengeABI } from './abis/IRollUpChallenge'
import { IRollUpableABI } from './abis/IRollUpable'
import { ISetupWizardABI } from './abis/ISetupWizard'
import { ITxChallengeABI } from './abis/ITxChallenge'
import { IUserInteractableABI } from './abis/IUserInteractable'
import { Layer2ABI } from './abis/Layer2'
import { Layer2ControllerABI } from './abis/Layer2Controller'
import { MiMCABI } from './abis/MiMC'
import { MigratableABI } from './abis/Migratable'
import { MigrationChallengeABI } from './abis/MigrationChallenge'
import { MigrationsABI } from './abis/Migrations'
import { PoseidonABI } from './abis/Poseidon'
import { RollUpChallengeABI } from './abis/RollUpChallenge'
import { RollUpableABI } from './abis/RollUpable'
import { SMT256ABI } from './abis/SMT256'
import { SetupWizardABI } from './abis/SetupWizard'
import { TestERC20ABI } from './abis/TestERC20'
import { TxChallengeABI } from './abis/TxChallenge'
import { UserInteractableABI } from './abis/UserInteractable'
import { ZkOptimisticRollUpABI } from './abis/ZkOptimisticRollUp'

export { Challengeable } from './contracts/Challengeable'
export { Configurated } from './contracts/Configurated'
export { Coordinatable } from './contracts/Coordinatable'
export { DepositChallenge } from './contracts/DepositChallenge'
export { DeserializationTester } from './contracts/DeserializationTester'
export { HeaderChallenge } from './contracts/HeaderChallenge'
export { ICoordinatable } from './contracts/ICoordinatable'
export { IDepositChallenge } from './contracts/IDepositChallenge'
export { IERC20 } from './contracts/IERC20'
export { IERC721 } from './contracts/IERC721'
export { IHeaderChallenge } from './contracts/IHeaderChallenge'
export { IMigratable } from './contracts/IMigratable'
export { IMigrationChallenge } from './contracts/IMigrationChallenge'
export { IRollUpChallenge } from './contracts/IRollUpChallenge'
export { IRollUpable } from './contracts/IRollUpable'
export { ISetupWizard } from './contracts/ISetupWizard'
export { ITxChallenge } from './contracts/ITxChallenge'
export { IUserInteractable } from './contracts/IUserInteractable'
export { Layer2 } from './contracts/Layer2'
export { Layer2Controller } from './contracts/Layer2Controller'
export { MiMC } from './contracts/MiMC'
export { Migratable } from './contracts/Migratable'
export { MigrationChallenge } from './contracts/MigrationChallenge'
export { Migrations } from './contracts/Migrations'
export { Poseidon } from './contracts/Poseidon'
export { RollUpChallenge } from './contracts/RollUpChallenge'
export { RollUpable } from './contracts/RollUpable'
export { SMT256 } from './contracts/SMT256'
export { SetupWizard } from './contracts/SetupWizard'
export { TestERC20 } from './contracts/TestERC20'
export { TxChallenge } from './contracts/TxChallenge'
export { UserInteractable } from './contracts/UserInteractable'
export { ZkOptimisticRollUp } from './contracts/ZkOptimisticRollUp'

export default class Deployed {
  static asChallengeable(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): Challengeable {
    const abi: any[] = [...ChallengeableABI]
    return new web3.eth.Contract(abi, address, option) as Challengeable
  }

  static asConfigurated(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): Configurated {
    const abi: any[] = [...ConfiguratedABI]
    return new web3.eth.Contract(abi, address, option) as Configurated
  }

  static asCoordinatable(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): Coordinatable {
    const abi: any[] = [...CoordinatableABI]
    return new web3.eth.Contract(abi, address, option) as Coordinatable
  }

  static asDepositChallenge(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): DepositChallenge {
    const abi: any[] = [...DepositChallengeABI]
    return new web3.eth.Contract(abi, address, option) as DepositChallenge
  }

  static asDeserializationTester(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): DeserializationTester {
    const abi: any[] = [...DeserializationTesterABI]
    return new web3.eth.Contract(abi, address, option) as DeserializationTester
  }

  static asHeaderChallenge(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): HeaderChallenge {
    const abi: any[] = [...HeaderChallengeABI]
    return new web3.eth.Contract(abi, address, option) as HeaderChallenge
  }

  static asICoordinatable(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): ICoordinatable {
    const abi: any[] = [...ICoordinatableABI]
    return new web3.eth.Contract(abi, address, option) as ICoordinatable
  }

  static asIDepositChallenge(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): IDepositChallenge {
    const abi: any[] = [...IDepositChallengeABI]
    return new web3.eth.Contract(abi, address, option) as IDepositChallenge
  }

  static asIERC20(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): IERC20 {
    const abi: any[] = [...IERC20ABI]
    return new web3.eth.Contract(abi, address, option) as IERC20
  }

  static asIERC721(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): IERC721 {
    const abi: any[] = [...IERC721ABI]
    return new web3.eth.Contract(abi, address, option) as IERC721
  }

  static asIHeaderChallenge(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): IHeaderChallenge {
    const abi: any[] = [...IHeaderChallengeABI]
    return new web3.eth.Contract(abi, address, option) as IHeaderChallenge
  }

  static asIMigratable(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): IMigratable {
    const abi: any[] = [...IMigratableABI]
    return new web3.eth.Contract(abi, address, option) as IMigratable
  }

  static asIMigrationChallenge(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): IMigrationChallenge {
    const abi: any[] = [...IMigrationChallengeABI]
    return new web3.eth.Contract(abi, address, option) as IMigrationChallenge
  }

  static asIRollUpChallenge(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): IRollUpChallenge {
    const abi: any[] = [...IRollUpChallengeABI]
    return new web3.eth.Contract(abi, address, option) as IRollUpChallenge
  }

  static asIRollUpable(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): IRollUpable {
    const abi: any[] = [...IRollUpableABI]
    return new web3.eth.Contract(abi, address, option) as IRollUpable
  }

  static asISetupWizard(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): ISetupWizard {
    const abi: any[] = [...ISetupWizardABI]
    return new web3.eth.Contract(abi, address, option) as ISetupWizard
  }

  static asITxChallenge(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): ITxChallenge {
    const abi: any[] = [...ITxChallengeABI]
    return new web3.eth.Contract(abi, address, option) as ITxChallenge
  }

  static asIUserInteractable(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): IUserInteractable {
    const abi: any[] = [...IUserInteractableABI]
    return new web3.eth.Contract(abi, address, option) as IUserInteractable
  }

  static asLayer2(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): Layer2 {
    const abi: any[] = [...Layer2ABI]
    return new web3.eth.Contract(abi, address, option) as Layer2
  }

  static asLayer2Controller(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): Layer2Controller {
    const abi: any[] = [...Layer2ControllerABI]
    return new web3.eth.Contract(abi, address, option) as Layer2Controller
  }

  static asMiMC(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): MiMC {
    const abi: any[] = [...MiMCABI]
    return new web3.eth.Contract(abi, address, option) as MiMC
  }

  static asMigratable(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): Migratable {
    const abi: any[] = [...MigratableABI]
    return new web3.eth.Contract(abi, address, option) as Migratable
  }

  static asMigrationChallenge(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): MigrationChallenge {
    const abi: any[] = [...MigrationChallengeABI]
    return new web3.eth.Contract(abi, address, option) as MigrationChallenge
  }

  static asMigrations(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): Migrations {
    const abi: any[] = [...MigrationsABI]
    return new web3.eth.Contract(abi, address, option) as Migrations
  }

  static asPoseidon(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): Poseidon {
    const abi: any[] = [...PoseidonABI]
    return new web3.eth.Contract(abi, address, option) as Poseidon
  }

  static asRollUpChallenge(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): RollUpChallenge {
    const abi: any[] = [...RollUpChallengeABI]
    return new web3.eth.Contract(abi, address, option) as RollUpChallenge
  }

  static asRollUpable(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): RollUpable {
    const abi: any[] = [...RollUpableABI]
    return new web3.eth.Contract(abi, address, option) as RollUpable
  }

  static asSMT256(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): SMT256 {
    const abi: any[] = [...SMT256ABI]
    return new web3.eth.Contract(abi, address, option) as SMT256
  }

  static asSetupWizard(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): SetupWizard {
    const abi: any[] = [...SetupWizardABI]
    return new web3.eth.Contract(abi, address, option) as SetupWizard
  }

  static asTestERC20(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): TestERC20 {
    const abi: any[] = [...TestERC20ABI]
    return new web3.eth.Contract(abi, address, option) as TestERC20
  }

  static asTxChallenge(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): TxChallenge {
    const abi: any[] = [...TxChallengeABI]
    return new web3.eth.Contract(abi, address, option) as TxChallenge
  }

  static asUserInteractable(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): UserInteractable {
    const abi: any[] = [...UserInteractableABI]
    return new web3.eth.Contract(abi, address, option) as UserInteractable
  }

  static asZkOptimisticRollUp(
    web3: Web3,
    address: string,
    option: ContractOptions,
  ): ZkOptimisticRollUp {
    const abi: any[] = [...ZkOptimisticRollUpABI]
    return new web3.eth.Contract(abi, address, option) as ZkOptimisticRollUp
  }
}
