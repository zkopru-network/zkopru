import { Signer } from "ethers";
import { Provider } from "@ethersproject/providers";
import {
  IChallengeable,
  IChallengeable__factory,
  ICoordinatable,
  ICoordinatable__factory,
  IDepositValidator,
  IDepositValidator__factory,
  IHeaderValidator,
  IHeaderValidator__factory,
  IMigratable,
  IMigratable__factory,
  IMigrationValidator,
  IMigrationValidator__factory,
  INullifierTreeValidator,
  INullifierTreeValidator__factory,
  ITxValidator,
  ITxValidator__factory,
  IUserInteractable,
  IUserInteractable__factory,
  IUtxoTreeValidator,
  IUtxoTreeValidator__factory,
  IWithdrawalTreeValidator,
  IWithdrawalTreeValidator__factory,
  ISetupWizard,
  ISetupWizard__factory,
  Zkopru,
  Zkopru__factory
} from "../typechain";

export class ZkopruContract {
  zkopru: Zkopru;

  coordinator: ICoordinatable;

  user: IUserInteractable;

  migrator: IMigratable;

  challenger: IChallengeable;

  validators: {
    deposit: IDepositValidator;
    migration: IMigrationValidator;
    header: IHeaderValidator;
    tx: ITxValidator;
    utxoTree: IUtxoTreeValidator;
    withdrawalTree: IWithdrawalTreeValidator;
    nullifierTree: INullifierTreeValidator;
  };

  setup: ISetupWizard;

  constructor(signerOrProvider: Signer | Provider, address: string) {
    this.zkopru = Zkopru__factory.connect(address, signerOrProvider);
    this.coordinator = ICoordinatable__factory.connect(
      address,
      signerOrProvider
    );
    this.user = IUserInteractable__factory.connect(address, signerOrProvider);
    this.migrator = IMigratable__factory.connect(address, signerOrProvider);
    this.challenger = IChallengeable__factory.connect(
      address,
      signerOrProvider
    );
    this.validators = {
      deposit: IDepositValidator__factory.connect(address, signerOrProvider),
      migration: IMigrationValidator__factory.connect(
        address,
        signerOrProvider
      ),
      header: IHeaderValidator__factory.connect(address, signerOrProvider),
      tx: ITxValidator__factory.connect(address, signerOrProvider),
      utxoTree: IUtxoTreeValidator__factory.connect(address, signerOrProvider),
      withdrawalTree: IWithdrawalTreeValidator__factory.connect(
        address,
        signerOrProvider
      ),
      nullifierTree: INullifierTreeValidator__factory.connect(
        address,
        signerOrProvider
      )
    };
    this.setup = ISetupWizard__factory.connect(address, signerOrProvider);
  }
}
