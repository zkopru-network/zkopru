import { BaseContract, BigNumberish } from "ethers";
import hre from "hardhat";
import fs from "fs";
import path from "path";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  BurnAuction,
  BurnAuction__factory,
  Challengeable,
  Challengeable__factory,
  Configurable,
  Configurable__factory,
  Coordinatable,
  Coordinatable__factory,
  DepositValidator,
  DepositValidator__factory,
  HeaderValidator,
  HeaderValidator__factory,
  Migratable,
  Migratable__factory,
  MigrationValidator,
  MigrationValidator__factory,
  NullifierTreeValidator,
  NullifierTreeValidator__factory,
  Poseidon2,
  Poseidon2__factory,
  Poseidon3,
  Poseidon3__factory,
  Poseidon4,
  Poseidon4__factory,
  TestERC20,
  TestERC20__factory,
  TestERC721,
  TestERC721__factory,
  TxValidator,
  TxValidator__factory,
  UserInteractable,
  UserInteractable__factory,
  UtxoTreeValidator,
  UtxoTreeValidator__factory,
  WithdrawalTreeValidator,
  WithdrawalTreeValidator__factory,
  Zkopru,
  Zkopru__factory
} from "../typechain";
import { ZkopruContract } from "../src";

const poseidonGenContract = require("circomlib/src/poseidon_gencontract.js");

let log = false;
export interface DeployOption {
  integrationTest?: boolean;
  log?: boolean;
}
export interface Contracts {
  zkopru: Zkopru;
  controllers: {
    ui: UserInteractable;
    coordinatable: Coordinatable;
    migratable: Migratable;
    configurable: Configurable;
    challengeable: Challengeable;
  };
  validators: {
    utxoTreeValidator: UtxoTreeValidator;
    withdrawalTreeValidator: WithdrawalTreeValidator;
    nullifierTreeValidator: NullifierTreeValidator;
    depositValidator: DepositValidator;
    headerValidator: HeaderValidator;
    txValidator: TxValidator;
    migrationValidator: MigrationValidator;
  };
  consensus: {
    burnAuction: BurnAuction;
  };
  utils: {
    testERC20: TestERC20;
    testERC721: TestERC721;
  };
}

async function waitAndLog(contract: BaseContract, name: string) {
  await contract.deployed();
  if (log) console.log(`${name}: ${contract.address}`);
}

function parseVK(
  vk: any
): {
  alpha1: { X: BigNumberish; Y: BigNumberish };
  beta2: {
    X: [BigNumberish, BigNumberish];
    Y: [BigNumberish, BigNumberish];
  };
  gamma2: {
    X: [BigNumberish, BigNumberish];
    Y: [BigNumberish, BigNumberish];
  };
  delta2: {
    X: [BigNumberish, BigNumberish];
    Y: [BigNumberish, BigNumberish];
  };
  ic: { X: BigNumberish; Y: BigNumberish }[];
} {
  return {
    alpha1: vk.vk_alpha_1.slice(0, 2),
    beta2: vk.vk_beta_2.slice(0, 2).map((a: any) => [...a].reverse()),
    gamma2: vk.vk_gamma_2.slice(0, 2).map((a: any) => [...a].reverse()),
    delta2: vk.vk_delta_2.slice(0, 2).map((a: any) => [...a].reverse()),
    ic: vk.IC.map((arr: string | any[]) => arr.slice(0, 2))
  };
}

// function save(name: string, address: string, network: number) {
//   const data = JSON.stringify({name, address, network}, null, 2);
//   if (!fs.existsSync("build/deployed")) {
//     fs.mkdirSync("build/deployed");
//   }
//   fs.writeFileSync(`build/deployed/${name}.json`, data);
// };

export async function deployPoseidon(
  deployer: SignerWithAddress
): Promise<{
  poseidon2: Poseidon2;
  poseidon3: Poseidon3;
  poseidon4: Poseidon4;
}> {
  const poseidon2 = await new Poseidon2__factory(
    poseidonGenContract.generateABI(2),
    poseidonGenContract.createCode(2),
    deployer
  ).deploy();
  await waitAndLog(poseidon2, "Poseidon2");
  const poseidon3 = await new Poseidon3__factory(
    poseidonGenContract.generateABI(3),
    poseidonGenContract.createCode(3),
    deployer
  ).deploy();
  await waitAndLog(poseidon3, "Poseidon3");
  const poseidon4 = await new Poseidon4__factory(
    poseidonGenContract.generateABI(4),
    poseidonGenContract.createCode(4),
    deployer
  ).deploy();
  await waitAndLog(poseidon4, "Poseidon4");
  return {
    poseidon2,
    poseidon3,
    poseidon4
  };
}

export async function deployTestTokens(
  deployer: SignerWithAddress
): Promise<{
  testERC20: TestERC20;
  testERC721: TestERC721;
}> {
  const testERC20 = await new TestERC20__factory(deployer).deploy();
  await waitAndLog(testERC20, "TestERC20");
  const testERC721 = await new TestERC721__factory(deployer).deploy();
  await waitAndLog(testERC721, "TestERC721");
  return {
    testERC20,
    testERC721
  };
}

export async function deployControllers(
  poseidon3: string,
  poseidon4: string,
  deployer: SignerWithAddress
): Promise<{
  ui: UserInteractable;
  coordinatable: Coordinatable;
  challengeable: Challengeable;
  migratable: Migratable;
  configurable: Configurable;
}> {
  const ui = await new UserInteractable__factory(
    {
      "contracts/zkopru/libraries/Hash.sol:Poseidon3": poseidon3,
      "contracts/zkopru/libraries/Hash.sol:Poseidon4": poseidon4
    },
    deployer
  ).deploy();
  await waitAndLog(ui, "UserInteractable");
  const coordinatable = await new Coordinatable__factory(deployer).deploy();
  await waitAndLog(coordinatable, "Coordinatable");
  const challengeable = await new Challengeable__factory(deployer).deploy();
  await waitAndLog(challengeable, "Challengeable");
  const migratable = await new Migratable__factory(deployer).deploy();
  await waitAndLog(migratable, "Migratable");
  const configurable = await new Configurable__factory(deployer).deploy();
  await waitAndLog(configurable, "Configurable");
  return {
    ui,
    coordinatable,
    challengeable,
    migratable,
    configurable
  };
}

export async function deployValidators(
  poseidon2: string,
  deployer: SignerWithAddress
): Promise<{
  utxoTreeValidator: UtxoTreeValidator;
  withdrawalTreeValidator: WithdrawalTreeValidator;
  nullifierTreeValidator: NullifierTreeValidator;
  headerValidator: HeaderValidator;
  txValidator: TxValidator;
  depositValidator: DepositValidator;
  migrationValidator: MigrationValidator;
}> {
  const utxoTreeValidator = await new UtxoTreeValidator__factory(
    {
      "contracts/zkopru/libraries/Hash.sol:Poseidon2": poseidon2
    },
    deployer
  ).deploy();
  await waitAndLog(utxoTreeValidator, "UtxoTreeValidator");
  const withdrawalTreeValidator = await new WithdrawalTreeValidator__factory(
    deployer
  ).deploy();
  await waitAndLog(withdrawalTreeValidator, "WithdrawalTreeValidator");
  const nullifierTreeValidator = await new NullifierTreeValidator__factory(
    deployer
  ).deploy();
  await waitAndLog(nullifierTreeValidator, "NullifierTreeValidator");
  const headerValidator = await new HeaderValidator__factory(deployer).deploy();
  await waitAndLog(headerValidator, "HeaderValidator");
  const txValidator = await new TxValidator__factory(deployer).deploy();
  await waitAndLog(txValidator, "TxValidator");
  const depositValidator = await new DepositValidator__factory(
    deployer
  ).deploy();
  await waitAndLog(depositValidator, "DepositValidator");
  const migrationValidator = await new MigrationValidator__factory(
    deployer
  ).deploy();
  await waitAndLog(migrationValidator, "MigrationValidator");
  return {
    utxoTreeValidator,
    withdrawalTreeValidator,
    nullifierTreeValidator,
    headerValidator,
    txValidator,
    depositValidator,
    migrationValidator
  };
}

export async function deployZkopru(
  deployer: SignerWithAddress
): Promise<{ zkopru: Zkopru }> {
  const zkopru = await new Zkopru__factory(deployer).deploy();
  await waitAndLog(zkopru, "Zkopru");
  return { zkopru };
}

export async function deployBurnAuction(
  zkopru: string,
  deployer: SignerWithAddress
): Promise<{ burnAuction: BurnAuction }> {
  const burnAuction = await new BurnAuction__factory(deployer).deploy(zkopru);
  return { burnAuction };
}

export async function setup(
  contracts: Contracts,
  deployer: SignerWithAddress,
  option?: DeployOption
) {
  const { zkopru, controllers, validators, consensus, utils } = contracts;
  // Setup proxy
  await zkopru.makeCoordinatable(controllers.coordinatable.address);
  await zkopru.makeUserInteractable(controllers.ui.address);
  await zkopru.makeChallengeable(
    controllers.challengeable.address,
    validators.depositValidator.address,
    validators.headerValidator.address,
    validators.migrationValidator.address,
    validators.utxoTreeValidator.address,
    validators.withdrawalTreeValidator.address,
    validators.nullifierTreeValidator.address,
    validators.txValidator.address
  );
  await zkopru.makeMigratable(controllers.migratable.address);
  await zkopru.makeConfigurable(controllers.configurable.address);
  const zkopruAsConfigurable = Configurable__factory.connect(
    zkopru.address,
    deployer
  );
  await zkopruAsConfigurable.setConsensusProvider(
    consensus.burnAuction.address
  );
  if (option?.integrationTest) {
    // integration test will run the below steps manually.
    return;
  }
  // Setup zkSNARKs
  // Setup migrations
  const keyDir = path.join(__dirname, "../keys/vks");

  // console.log(path.resolve(keyDir))
  for (let nIn = 1; nIn <= 4; nIn += 1) {
    for (let nOut = 1; nOut <= 4; nOut += 1) {
      const vk = JSON.parse(
        fs
          .readFileSync(
            path.join(keyDir, `/zk_transaction_${nIn}_${nOut}.vk.json`)
          )
          .toString()
      );
      await zkopru.registerVk(nIn, nOut, parseVK(vk));
    }
  }
  // await wizard.allowMigrants(...)

  const zkopruAscoordinatable = Coordinatable__factory.connect(
    zkopru.address,
    deployer
  );
  // register erc20
  await zkopruAscoordinatable.registerERC20(utils.testERC20.address);
  // register erc721
  await zkopruAscoordinatable.registerERC721(utils.testERC721.address);
  if (hre.network.name === "testnet") {
    // Register as coordinator
    const zkopruAsConfigurable = Configurable__factory.connect(
      zkopru.address,
      deployer
    );
    await zkopruAsConfigurable.setChallengePeriod(30);
    // await consensus.burnAuction.register({ value: "32000000000000000000" });
  }
  // Complete setup
  await zkopru.completeSetup();
}

export async function migrateTest(
  contracts: Contracts,
  deployer: SignerWithAddress,
  option?: DeployOption
) {
  const {
    zkopru: source,
    controllers,
    validators,
    consensus,
    utils
  } = contracts;
  // Setup proxy
  const dest = await new Zkopru__factory(deployer).deploy();
  await waitAndLog(dest, "Zkopru 2");
  await dest.makeCoordinatable(controllers.coordinatable.address);
  await dest.makeUserInteractable(controllers.ui.address);
  await dest.makeChallengeable(
    controllers.challengeable.address,
    validators.depositValidator.address,
    validators.headerValidator.address,
    validators.migrationValidator.address,
    validators.utxoTreeValidator.address,
    validators.withdrawalTreeValidator.address,
    validators.nullifierTreeValidator.address,
    validators.txValidator.address
  );
  await dest.makeMigratable(controllers.migratable.address);
  await dest.makeConfigurable(controllers.configurable.address);
  const zkopruAsConfigurable = Configurable__factory.connect(
    dest.address,
    deployer
  );
  await zkopruAsConfigurable.setConsensusProvider(
    consensus.burnAuction.address
  );
  if (option?.integrationTest) {
    // integration test will run the below steps manually.
    return;
  }
  // Setup zkSNARKs
  // Setup migrations
  const keyDir = path.join(__dirname, "../keys/vks");

  // console.log(path.resolve(keyDir))
  for (let nIn = 1; nIn <= 4; nIn += 1) {
    for (let nOut = 1; nOut <= 4; nOut += 1) {
      const vk = JSON.parse(
        fs
          .readFileSync(
            path.join(keyDir, `/zk_transaction_${nIn}_${nOut}.vk.json`)
          )
          .toString()
      );
      await dest.registerVk(nIn, nOut, parseVK(vk));
    }
  }
  await dest.allowMigrants([source.address]);

  const zkopruAscoordinatable = Coordinatable__factory.connect(
    dest.address,
    deployer
  );
  // register erc20
  await zkopruAscoordinatable.registerERC20(utils.testERC20.address);
  // register erc721
  await zkopruAscoordinatable.registerERC721(utils.testERC721.address);
  if (hre.network.name === "testnet") {
    // Register as coordinator
    const zkopruAsConfigurable = Configurable__factory.connect(
      dest.address,
      deployer
    );
    await zkopruAsConfigurable.setChallengePeriod(30);
    await consensus.burnAuction.register({ value: "32000000000000000000" });
  }
  // Complete setup
  await dest.completeSetup();
}

export async function deploy(
  deployer: SignerWithAddress,
  option?: DeployOption
): Promise<{
  zkopru: ZkopruContract;
  contracts: Contracts;
}> {
  if (option?.log) log = true;
  const { poseidon2, poseidon3, poseidon4 } = await deployPoseidon(deployer);
  const utils = await deployTestTokens(deployer);
  const controllers = await deployControllers(
    poseidon3.address,
    poseidon4.address,
    deployer
  );
  const validators = await deployValidators(poseidon2.address, deployer);
  const { zkopru } = await deployZkopru(deployer);
  const consensus = await deployBurnAuction(zkopru.address, deployer);
  const contracts: Contracts = {
    zkopru,
    controllers,
    validators,
    utils,
    consensus
  };
  await setup(contracts, deployer, option);
  await migrateTest(contracts, deployer, option);
  if (hre.network.name === "testnet") {
    // Set interval mining instead autoMining due to coordinator's block confirmation
    await hre.network.provider.send(`evm_setAutomine`, [false]);
    await hre.network.provider.send(`evm_setIntervalMining`, [5000]);
  }
  return {
    zkopru: new ZkopruContract(deployer, zkopru.address),
    contracts
  };
}
