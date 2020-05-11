/* eslint-disable jest/no-expect-resolves */
/* eslint-disable jest/require-tothrow-message */
/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable jest/no-hooks */
/**
 * @jest-environment node
 */
import { Docker } from 'node-docker-api'
import { nSQL, InanoSQLInstance } from '@nano-sql/core'
import { Container } from 'node-docker-api/lib/container'
import Web3 from 'web3'
import { toWei } from 'web3-utils'
import { ZkAccount, HDWallet } from '~account'
import { schema } from '~database'
import { sleep, readFromContainer } from '~utils'
import { L1Contract } from '~core/layer1'

describe('testnet', () => {
  let layer1Container: Container
  let circuitArtifactContainer: Container
  let accounts: {
    coordinator: ZkAccount
    alice: ZkAccount
    bob: ZkAccount
    carl: ZkAccount
  }
  let web3: Web3
  let zkopruAddress: string
  let db: InanoSQLInstance
  let contract: L1Contract
  beforeAll(async () => {
    const docker = new Docker({ socketPath: '/var/run/docker.sock' })
    layer1Container = await docker.container.create({
      Image: 'zkopru:contract',
      name: Math.random()
        .toString(36)
        .substring(2, 16),
      rm: true,
    })
    circuitArtifactContainer = await docker.container.create({
      Image: 'zkopru:circuits',
      name: Math.random()
        .toString(36)
        .substring(2, 16),
      rm: true,
    })
    await Promise.all([
      layer1Container.start(),
      circuitArtifactContainer.start(),
    ])
    const deployed = await readFromContainer(
      layer1Container,
      '/proj/build/deployed/ZkOptimisticRollUp.json',
    )
    zkopruAddress = JSON.parse(deployed.toString()).address
    const status = await layer1Container.status()
    const containerIP = (status.data as {
      NetworkSettings: { IPAddress: string }
    }).NetworkSettings.IPAddress
    sleep(2000)
    console.log('Running testnet on ', `${containerIP}:5000`)
    const provider = new Web3.providers.WebsocketProvider(
      `ws://${containerIP}:5000`,
      { reconnect: { auto: true } },
    )
    async function waitConnection() {
      return new Promise<void>(res => {
        if (provider.connected) res()
        provider.on('connect', res)
      })
    }
    await waitConnection()
    console.log('Websocket connection with ', `${containerIP}:5000`)
    web3 = new Web3(provider)
    contract = new L1Contract(web3, zkopruAddress)
    const dbName = 'zkopruFullNodeTester'
    await nSQL().createDatabase({
      id: dbName,
      mode: 'TEMP',
      tables: [
        schema.utxo,
        schema.utxoTree,
        schema.withdrawal,
        schema.withdrawalTree,
        schema.nullifiers,
        schema.nullifierTreeNode,
        schema.migration,
        schema.deposit,
        schema.massDeposit,
        schema.chain,
        schema.keystore,
        schema.hdWallet,
      ],
      version: 3,
    })
    db = nSQL().useDatabase(dbName)
  }, 10000)
  afterAll(async () => {
    await layer1Container.stop()
    await layer1Container.delete()
    await circuitArtifactContainer.stop()
    await circuitArtifactContainer.delete()
    await db.disconnect()
  })
  describe('contract deployment', () => {
    it('should define zkopru address', () => {
      expect(zkopruAddress).toBeDefined()
    })
  })
  describe('1: create zk snark compatible accounts', () => {
    beforeAll(async () => {
      const hdWallet = new HDWallet(db)
      const mnemonic =
        'myth like bonus scare over problem client lizard pioneer submit female collect'
      await hdWallet.init(mnemonic, 'samplepassword')
      const coordinator = await hdWallet.createAccount(0)
      const alice = await hdWallet.createAccount(1)
      const bob = await hdWallet.createAccount(2)
      const carl = await hdWallet.createAccount(3)
      accounts = { coordinator, alice, bob, carl }
    })
    it('alice should have 100 ETH for her initial balance', async () => {
      expect(
        await web3.eth.getBalance(accounts.alice.ethAccount.address),
      ).toStrictEqual(toWei('100'))
    })
    it('bob should have 100 ETH for his initial balance', async () => {
      expect(
        await web3.eth.getBalance(accounts.bob.ethAccount.address),
      ).toStrictEqual(toWei('100'))
    })
    it('carl should have 100 ETH for his initial balance', async () => {
      expect(
        await web3.eth.getBalance(accounts.carl.ethAccount.address),
      ).toStrictEqual(toWei('100'))
    })
  })
  describe('2: coordinator registers verifying keys', () => {
    const nIn = [1, 2, 3, 4]
    const nOut = [1, 2, 3, 4]
    let vks!: { [nIn: number]: { [nOut: number]: any } }
    beforeAll(async () => {
      vks = {
        1: {},
        2: {},
        3: {},
        4: {},
      }
      const readVKs: (() => Promise<void>)[] = []
      nIn.forEach(i => {
        nOut.forEach(j => {
          const readVK = async () => {
            const vk = JSON.parse(
              (
                await readFromContainer(
                  circuitArtifactContainer,
                  '/proj/build/vks/zk_transaction_1_1.vk.json',
                )
              ).toString('utf8'),
            )
            vks[i][j] = vk
          }
          readVKs.push(readVK)
        })
      })
      await Promise.all(readVKs.map(f => f()))
    })
    it('coordinator can register vks', async () => {
      const registerVKs: (() => Promise<void>)[] = []
      let registeredNum = 0
      nIn.forEach(i => {
        nOut.forEach(j => {
          registerVKs.push(async () => {
            const tx = contract.setup.methods.registerVk(
              i,
              j,
              vks[i][j].vk_alfa_1.slice(0, 2),
              vks[i][j].vk_beta_2.slice(0, 2),
              vks[i][j].vk_gamma_2.slice(0, 2),
              vks[i][j].vk_delta_2.slice(0, 2),
              vks[i][j].IC.map((arr: string[][]) => arr.slice(0, 2)),
            )
            const estimatedGas = await tx.estimateGas()
            const receipt = await tx.send({
              from: accounts.coordinator.address,
              gas: estimatedGas,
            })
            registeredNum += 1
            expect(receipt).toBeDefined()
          })
        })
      })
      await Promise.all(registerVKs.map(f => f()))
      expect(registeredNum).toStrictEqual(16)
    })
    it('alice, bob, and carl cannot register vk', async () => {
      const sampleVk = vks[4][4]
      const tx = contract.setup.methods.registerVk(
        5,
        5,
        sampleVk.vk_alfa_1.slice(0, 2),
        sampleVk.vk_beta_2.slice(0, 2),
        sampleVk.vk_gamma_2.slice(0, 2),
        sampleVk.vk_delta_2.slice(0, 2),
        sampleVk.IC.map((arr: string[][]) => arr.slice(0, 2)),
      )
      const estimatedGas = await tx.estimateGas()
      await expect(
        tx.send({ from: accounts.alice.address, gas: estimatedGas }),
      ).rejects.toThrow()
      await expect(
        tx.send({ from: accounts.bob.address, gas: estimatedGas }),
      ).rejects.toThrow()
      await expect(
        tx.send({ from: accounts.carl.address, gas: estimatedGas }),
      ).rejects.toThrow()
    })
  })
  describe('3: coordinator completes the setup', () => {
    describe('3-1: coordinator can complete the setup while alice, bob, and carl fails', () => {
      it('coordinator can complete the setup while alice, bob, and carl fails', async () => {
        const tx = contract.setup.methods.completeSetup()
        const gas = await tx.estimateGas()
        await expect(
          tx.send({ from: accounts.alice.address, gas }),
        ).rejects.toThrow()
        await expect(
          tx.send({ from: accounts.bob.address, gas }),
        ).rejects.toThrow()
        await expect(
          tx.send({ from: accounts.carl.address, gas }),
        ).rejects.toThrow()
        await expect(
          tx.send({ from: accounts.coordinator.address, gas }),
        ).resolves.toHaveProperty('transactionHash')
      })
    })
    describe('3-2: once the coordinator completes the setup, no one can register new keys', () => {
      it('should reject every register txs', async () => {
        const tx = contract.setup.methods.completeSetup()
        await expect(
          tx.estimateGas({ from: accounts.alice.address }),
        ).rejects.toThrow()
        await expect(
          tx.estimateGas({ from: accounts.bob.address }),
        ).rejects.toThrow()
        await expect(
          tx.estimateGas({ from: accounts.carl.address }),
        ).rejects.toThrow()
        await expect(
          tx.estimateGas({ from: accounts.coordinator.address }),
        ).rejects.toThrow()
      })
    })
  })
})
