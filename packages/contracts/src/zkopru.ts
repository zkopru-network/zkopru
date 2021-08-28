import Web3 from 'web3'
import { ContractOptions } from 'web3-eth-contract'
import { IChallengeable } from '../src/contracts/IChallengeable'
import { ICoordinatable } from '../src/contracts/ICoordinatable'
import { IDepositValidator } from '../src/contracts/IDepositValidator'
import { IHeaderValidator } from '../src/contracts/IHeaderValidator'
import { IMigratable } from '../src/contracts/IMigratable'
import { IMigrationValidator } from '../src/contracts/IMigrationValidator'
import { INullifierTreeValidator } from '../src/contracts/INullifierTreeValidator'
import { ISetupWizard } from '../src/contracts/ISetupWizard'
import { ITxValidator } from '../src/contracts/ITxValidator'
import { IUserInteractable } from '../src/contracts/IUserInteractable'
import { IUtxoTreeValidator } from '../src/contracts/IUtxoTreeValidator'
import { IWithdrawalTreeValidator } from '../src/contracts/IWithdrawalTreeValidator'
import { Zkopru } from '../src/contracts/Zkopru'

import { Layer1 } from './layer1'

export class ZkopruContract {
  upstream: Zkopru

  coordinator: ICoordinatable

  user: IUserInteractable

  migrator: IMigratable

  challenger: IChallengeable

  validators: {
    deposit: IDepositValidator
    migration: IMigrationValidator
    header: IHeaderValidator
    tx: ITxValidator
    utxoTree: IUtxoTreeValidator
    withdrawalTree: IWithdrawalTreeValidator
    nullifierTree: INullifierTreeValidator
  }

  setup: ISetupWizard

  constructor(web3: Web3, address: string, option?: ContractOptions) {
    this.upstream = Layer1.getZkopru(web3, address, option)
    this.coordinator = Layer1.getICoordinatable(web3, address, option)
    this.user = Layer1.getIUserInteractable(web3, address, option)
    this.migrator = Layer1.getIMigratable(web3, address, option)
    this.challenger = Layer1.getIChallengeable(web3, address, option)
    this.validators = {
      deposit: Layer1.getIDepositValidator(web3, address, option),
      migration: Layer1.getIMigrationValidator(web3, address, option),
      header: Layer1.getIHeaderValidator(web3, address, option),
      tx: Layer1.getITxValidator(web3, address, option),
      utxoTree: Layer1.getIUtxoTreeValidator(web3, address, option),
      withdrawalTree: Layer1.getIWithdrawalTreeValidator(web3, address, option),
      nullifierTree: Layer1.getINullifierTreeValidator(web3, address, option),
    }
    this.setup = Layer1.getISetupWizard(web3, address, option)
  }
}
