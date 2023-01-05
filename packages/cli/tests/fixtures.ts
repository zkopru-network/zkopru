import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { JsonRpcProvider } from '@ethersproject/providers'
import { TestERC20, TestERC721, ZkopruContract } from '@zkopru/contracts'
import { deploy } from '~contracts-utils/deployer'

export interface TestFixture {
  deployer: SignerWithAddress
  testERC20: TestERC20
  testERC721: TestERC721
  zkopru: ZkopruContract
}

export class FixtureProvider {
  private readonly _provider: JsonRpcProvider

  private _fixtures?: TestFixture

  private _fixtureSnapshotId?: string

  private _snapshots: { [key: string]: string } = {}

  constructor() {
    this._provider = ethers.provider
  }

  async getDeployer(): Promise<SignerWithAddress> {
    return (await ethers.getSigners())[0]
  }

  async getFixtures(): Promise<TestFixture> {
    if (!this._fixtures) {
      // deploy the contracts first
      const deployer = await this.getDeployer()
      this._fixtures = await this.deployContracts(deployer)
    }
    if (this._fixtureSnapshotId) {
      // snapshot exists.
      await this._provider.send('evm_revert', [this._fixtureSnapshotId])
    }
    const newSnapshot = await this._provider.send('evm_snapshot', [])
    this._fixtureSnapshotId = newSnapshot
    return this._fixtures
  }

  async snapshot(key: string): Promise<string> {
    const newSnapshot = await this._provider.send('evm_snapshot', [])
    this._snapshots[key] = newSnapshot
    return newSnapshot
  }

  async revert(key: string): Promise<string> {
    const snapshotId = this._snapshots[key]
    if (snapshotId) {
      await this._provider.send('evm_revert', [snapshotId])
    } else {
      throw Error(`No snapshot exists for ${key}`)
    }
    const newSnapshot = await this._provider.send('evm_snapshot', [])
    this._snapshots[key] = newSnapshot
    return newSnapshot
  }

  async advanceBlock(n?: number): Promise<void> {
    const times = n ?? 1
    for (let i = 0; i < times; i += 1) {
      await this._provider.send('evm_mine', [])
    }
  }

  async mineBlock(timestamp?: number): Promise<void> {
    if (timestamp) {
      await this._provider.send('evm_setNextBlockTimestamp', [timestamp])
    }

    await this._provider.send('evm_mine', [])
  }

  async increaseTime(seconds: number): Promise<void> {
    await this._provider.send('evm_increaseTime', [seconds])
    await this._provider.send('evm_mine', [])
  }

  private async deployContracts(
    deployer: SignerWithAddress,
  ): Promise<TestFixture> {
    const { zkopru, contracts } = await deploy(deployer, {
      integrationTest: true,
    })
    return {
      deployer,
      zkopru,
      testERC20: contracts.utils.testERC20,
      testERC721: contracts.utils.testERC721,
    }
  }
}
