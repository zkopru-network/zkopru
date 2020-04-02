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
import { AssetHandlerABI } from './abis/AssetHandler'
import { ChallengeableABI } from './abis/Challengeable'
import { ConfiguratedABI } from './abis/Configurated'
import { CoordinatableABI } from './abis/Coordinatable'
import { DepositChallengeABI } from './abis/DepositChallenge'
import { DeserializationTesterABI } from './abis/DeserializationTester'
import { DeserializerABI } from './abis/Deserializer'
import { HashABI } from './abis/Hash'
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
import { PairingABI } from './abis/Pairing'
import { PoseidonABI } from './abis/Poseidon'
import { RollUpChallengeABI } from './abis/RollUpChallenge'
import { RollUpLibABI } from './abis/RollUpLib'
import { RollUpableABI } from './abis/RollUpable'
import { SMT256ABI } from './abis/SMT256'
import { SNARKsVerifierABI } from './abis/SNARKsVerifier'
import { SetupWizardABI } from './abis/SetupWizard'
import { SubTreeRollUpLibABI } from './abis/SubTreeRollUpLib'
import { TestERC20ABI } from './abis/TestERC20'
import { TxChallengeABI } from './abis/TxChallenge'
import { TypesABI } from './abis/Types'
import { UserInteractableABI } from './abis/UserInteractable'
import { ZkOptimisticRollUpABI } from './abis/ZkOptimisticRollUp'

export const Contracts = {
  Challengeable,
  Configurated,
  Coordinatable,
  DepositChallenge,
  DeserializationTester,
  HeaderChallenge,
  ICoordinatable,
  IDepositChallenge,
  IERC20,
  IERC721,
  IHeaderChallenge,
  IMigratable,
  IMigrationChallenge,
  IRollUpChallenge,
  IRollUpable,
  ISetupWizard,
  ITxChallenge,
  IUserInteractable,
  Layer2,
  Layer2Controller,
  MiMC,
  Migratable,
  MigrationChallenge,
  Migrations,
  Poseidon,
  RollUpChallenge,
  RollUpable,
  SMT256,
  SetupWizard,
  TestERC20,
  TxChallenge,
  UserInteractable,
  ZkOptimisticRollUp,
}

export const ABIs = {
  AssetHandlerABI,
  ChallengeableABI,
  ConfiguratedABI,
  CoordinatableABI,
  DepositChallengeABI,
  DeserializationTesterABI,
  DeserializerABI,
  HashABI,
  HeaderChallengeABI,
  ICoordinatableABI,
  IDepositChallengeABI,
  IERC20ABI,
  IERC721ABI,
  IHeaderChallengeABI,
  IMigratableABI,
  IMigrationChallengeABI,
  IRollUpChallengeABI,
  IRollUpableABI,
  ISetupWizardABI,
  ITxChallengeABI,
  IUserInteractableABI,
  Layer2ABI,
  Layer2ControllerABI,
  MiMCABI,
  MigratableABI,
  MigrationChallengeABI,
  MigrationsABI,
  PairingABI,
  PoseidonABI,
  RollUpChallengeABI,
  RollUpLibABI,
  RollUpableABI,
  SMT256ABI,
  SNARKsVerifierABI,
  SetupWizardABI,
  SubTreeRollUpLibABI,
  TestERC20ABI,
  TxChallengeABI,
  TypesABI,
  UserInteractableABI,
  ZkOptimisticRollUpABI,
}
