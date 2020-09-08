import Web3 from 'web3'
import { ContractOptions } from 'web3-eth-contract'
import { ICoordinatable } from './contracts/ICoordinatable'
import { IDepositChallenge } from './contracts/IDepositChallenge'
import { IHeaderChallenge } from './contracts/IHeaderChallenge'
import { IMigratable } from './contracts/IMigratable'
import { IMigrationChallenge } from './contracts/IMigrationChallenge'
import { INullifierTreeChallenge } from './contracts/INullifierTreeChallenge'
import { ISetupWizard } from './contracts/ISetupWizard'
import { ITxChallenge } from './contracts/ITxChallenge'
import { IUserInteractable } from './contracts/IUserInteractable'
import { IUtxoTreeChallenge } from './contracts/IUtxoTreeChallenge'
import { IWithdrawalTreeChallenge } from './contracts/IWithdrawalTreeChallenge'
import { ZkOptimisticRollUp } from './contracts/ZkOptimisticRollUp'

import { Layer1 } from './layer1'

export class ZkOPRUContract {
  upstream: ZkOptimisticRollUp

  coordinator: ICoordinatable

  user: IUserInteractable

  migrator: IMigratable

  challenger: {
    deposit: IDepositChallenge
    migration: IMigrationChallenge
    header: IHeaderChallenge
    tx: ITxChallenge
    utxoTree: IUtxoTreeChallenge
    withdrawalTree: IWithdrawalTreeChallenge
    nullifierTree: INullifierTreeChallenge
  }

  setup: ISetupWizard

  constructor(web3: Web3, address: string, option?: ContractOptions) {
    this.upstream = Layer1.getZkOptimisticRollUp(web3, address, option)
    this.coordinator = Layer1.getICoordinatable(web3, address, option)
    this.user = Layer1.getIUserInteractable(web3, address, option)
    this.migrator = Layer1.getIMigratable(web3, address, option)
    this.challenger = {
      deposit: Layer1.getIDepositChallenge(web3, address, option),
      migration: Layer1.getIMigrationChallenge(web3, address, option),
      header: Layer1.getIHeaderChallenge(web3, address, option),
      tx: Layer1.getITxChallenge(web3, address, option),
      utxoTree: Layer1.getIUtxoTreeChallenge(web3, address, option),
      withdrawalTree: Layer1.getIWithdrawalTreeChallenge(web3, address, option),
      nullifierTree: Layer1.getINullifierTreeChallenge(web3, address, option),
    }
    this.setup = Layer1.getISetupWizard(web3, address, option)
  }
}
