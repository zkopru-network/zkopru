import { ethers } from "hardhat";
import { JsonRpcProvider } from "@ethersproject/providers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  BurnAuctionTester,
  CoordinatableTester,
  CoordinatableTester__factory,
  DeserializationTester,
  DeserializationTester__factory,
  HeaderValidatorTester,
  PoseidonTester,
  PoseidonTester__factory,
  TestERC20,
  TestERC20__factory,
  TestERC721,
  TestERC721__factory,
  TxValidatorTester,
  UserInteractableTester,
  UserInteractableTester__factory,
  UtxoTreeTester,
  UtxoTreeTester__factory,
  UtxoTreeValidatorTester,
  ZkopruStubTester,
  TxValidatorTester__factory,
  HeaderValidatorTester__factory,
  UtxoTreeValidatorTester__factory,
  BurnAuctionTester__factory,
  ZkopruStubTester__factory,
  SNARKTester,
  SNARKTester__factory
} from "../typechain";
import {
  Poseidon2,
  Poseidon3,
  Poseidon4,
  Poseidon2__factory,
  Poseidon3__factory,
  Poseidon4__factory
} from "../../typechain";

const poseidonGenContract = require("circomlib/src/poseidon_gencontract.js");

export interface ZkopruTestFixture {
  deployer: SignerWithAddress;
  testERC20: TestERC20;
  testERC721: TestERC721;
  coordinatableTester: CoordinatableTester;
  userInteractableTester: UserInteractableTester;
  poseidon2: Poseidon2;
  poseidon3: Poseidon3;
  poseidon4: Poseidon4;
  poseidonTester: PoseidonTester;
  deserializationTester: DeserializationTester;
  utxoTreeTester: UtxoTreeTester;
  headerValidatorTester: HeaderValidatorTester;
  txValidatorTester: TxValidatorTester;
  utxoTreeValidatorTester: UtxoTreeValidatorTester;
  burnAuctionTester: BurnAuctionTester;
  zkopruStubTester: ZkopruStubTester;
  snarkTester: SNARKTester;
}

export class Context {
  private readonly _provider: JsonRpcProvider;
  private _fixtures?: ZkopruTestFixture;
  private _fixtureSnapshotId?: string;
  private _snapshots: { [key: string]: string } = {};

  constructor() {
    this._provider = ethers.provider;
  }

  async getDeployer(): Promise<SignerWithAddress> {
    return (await ethers.getSigners())[0];
  }

  async getFixtures(): Promise<ZkopruTestFixture> {
    if (!this._fixtures) {
      // deploy the contracts first
      const deployer = await this.getDeployer();
      this._fixtures = await this.deployContracts(deployer);
    }
    if (this._fixtureSnapshotId) {
      // snapshot exists.
      await this._provider.send("evm_revert", [this._fixtureSnapshotId]);
    }
    const newSnapshot = await this._provider.send("evm_snapshot", []);
    this._fixtureSnapshotId = newSnapshot;
    return this._fixtures;
  }

  async snapshot(key: string): Promise<string> {
    const newSnapshot = await this._provider.send("evm_snapshot", []);
    this._snapshots[key] = newSnapshot;
    return newSnapshot;
  }

  async revert(key: string): Promise<string> {
    const snapshotId = this._snapshots[key];
    if (snapshotId) {
      await this._provider.send("evm_revert", [snapshotId]);
    } else {
      throw Error(`No snapshot exists for ${key}`);
    }
    const newSnapshot = await this._provider.send("evm_snapshot", []);
    this._snapshots[key] = newSnapshot;
    return newSnapshot;
  }

  async advanceBlock(): Promise<void> {
    await this._provider.send("evm_mine", []);
  }

  private async deployContracts(deployer: SignerWithAddress) {
    const deserializationTester = await new DeserializationTester__factory(
      deployer
    ).deploy();
    const poseidon2 = await new Poseidon2__factory(
      poseidonGenContract.generateABI(2),
      poseidonGenContract.createCode(2),
      deployer
    ).deploy();
    const poseidon3 = await new Poseidon3__factory(
      poseidonGenContract.generateABI(3),
      poseidonGenContract.createCode(3),
      deployer
    ).deploy();
    const poseidon4 = await new Poseidon4__factory(
      poseidonGenContract.generateABI(4),
      poseidonGenContract.createCode(4),
      deployer
    ).deploy();
    const poseidonTester = await new PoseidonTester__factory(
      {
        "target/zkopru/libraries/Hash.sol:Poseidon2": poseidon2.address,
        "target/zkopru/libraries/Hash.sol:Poseidon3": poseidon3.address,
        "target/zkopru/libraries/Hash.sol:Poseidon4": poseidon4.address
      },
      deployer
    ).deploy();
    const utxoTreeTester = await new UtxoTreeTester__factory(
      {
        "target/zkopru/libraries/Hash.sol:Poseidon2": poseidon2.address
      },
      deployer
    ).deploy();
    const txValidatorTester = await new TxValidatorTester__factory(
      deployer
    ).deploy();
    const testERC20 = await new TestERC20__factory(deployer).deploy();
    const testERC721 = await new TestERC721__factory(deployer).deploy();
    const coordinatableTester = await new CoordinatableTester__factory(
      deployer
    ).deploy();
    const userInteractableTester = await new UserInteractableTester__factory(
      {
        "target/zkopru/libraries/Hash.sol:Poseidon3": poseidon3.address,
        "target/zkopru/libraries/Hash.sol:Poseidon4": poseidon4.address
      },
      deployer
    ).deploy();
    const headerValidatorTester = await new HeaderValidatorTester__factory(
      deployer
    ).deploy();
    const utxoTreeValidatorTester = await new UtxoTreeValidatorTester__factory(
      {
        "target/zkopru/libraries/Hash.sol:Poseidon2": poseidon2.address
      },
      deployer
    ).deploy();
    const zkopruStubTester = await new ZkopruStubTester__factory(
      deployer
    ).deploy();
    const burnAuctionTester = await new BurnAuctionTester__factory(
      deployer
    ).deploy(zkopruStubTester.address);
    const snarkTester = await new SNARKTester__factory(deployer).deploy();
    return {
      deployer,
      poseidon2,
      poseidon3,
      poseidon4,
      poseidonTester,
      deserializationTester,
      testERC20,
      testERC721,
      coordinatableTester,
      userInteractableTester,
      utxoTreeTester,
      txValidatorTester,
      headerValidatorTester,
      utxoTreeValidatorTester,
      burnAuctionTester,
      zkopruStubTester,
      snarkTester
    };
  }
}
