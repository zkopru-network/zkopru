/* eslint-disable @typescript-eslint/camelcase */
import { ZkopruContract } from '@zkopru/contracts'
import { Config } from '@zkopru/database'
import { hexify, logger } from '@zkopru/utils'
import { Provider } from '@ethersproject/providers'
import * as ffjs from 'ffjavascript'
import { soliditySha3 } from 'web3-utils'
import AsyncLock from 'async-lock'
import { verifyingKeyIdentifier, VerifyingKey } from '../snark/snark-verifier'

// https://github.com/zkopru-network/zkopru/issues/235
export const MAX_MASS_DEPOSIT_COMMIT_GAS = 72000

export class L1Contract extends ZkopruContract {
  provider: Provider

  address: string

  config?: Config

  sendTxLock: AsyncLock

  constructor(provider: Provider, address: string) {
    super(provider, address)
    logger.trace(
      `core/layer1.ts - L1Contract::constructor(${address.slice(0, 6)}...)`,
    )
    this.provider = provider
    this.address = address
    this.sendTxLock = new AsyncLock()
  }

  async getVKs(): Promise<{ [txSig: string]: VerifyingKey }> {
    logger.trace(`core/layer1.ts - L1Contract::getVKs()`)
    const NUM_OF_INPUTS = 4
    const NUM_OF_OUTPUTS = 4
    const vks: { [txSig: string]: VerifyingKey } = {}
    const tasks: (() => Promise<void>)[] = []
    const bn128 = await ffjs.buildBn128()
    // const stringify = (val: unknown) => BigInt(val).toString(10)
    for (let nI = 1; nI <= NUM_OF_INPUTS; nI += 1) {
      for (let nO = 1; nO <= NUM_OF_OUTPUTS; nO += 1) {
        tasks.push(async () => {
          const vk = await this.zkopru.getVk(nI, nO)
          const sig = verifyingKeyIdentifier(nI, nO)
          const vk_alpha_1 = [
            vk.alpha1[0].toBigInt(),
            vk.alpha1[1].toBigInt(),
            BigInt('1'),
          ]
          // caution: snarkjs G2Point is reversed
          const vk_beta_2 = [
            [vk.beta2[0][1].toBigInt(), vk.beta2[0][0].toBigInt()],
            [vk.beta2[1][1].toBigInt(), vk.beta2[1][0].toBigInt()],
            [BigInt('1'), BigInt('0')],
          ]
          const vk_gamma_2 = [
            [vk.gamma2[0][1].toBigInt(), vk.gamma2[0][0].toBigInt()],
            [vk.gamma2[1][1].toBigInt(), vk.gamma2[1][0].toBigInt()],
            [BigInt('1'), BigInt('0')],
          ]
          const vk_delta_2 = [
            [vk.delta2[0][1].toBigInt(), vk.delta2[0][0].toBigInt()],
            [vk.delta2[1][1].toBigInt(), vk.delta2[1][0].toBigInt()],
            [BigInt('1'), BigInt('0')],
          ]
          const vk_alphabeta_12 = bn128.pairing(
            bn128.G1.fromObject(vk_alpha_1),
            bn128.G2.fromObject(vk_beta_2),
          )
          const IC = vk.ic.map(ic => [...ic.map(v => v.toBigInt())])
          vks[sig] = {
            protocol: 'groth16',
            curve: 'bn128',
            nPublic: vk.ic.length - 1,
            vk_alpha_1,
            vk_beta_2,
            vk_gamma_2,
            vk_delta_2,
            vk_alphabeta_12,
            IC,
          }
        })
      }
    }
    await Promise.all(tasks.map(task => task()))
    await bn128.terminate()
    return vks
  }

  async getConfig(): Promise<Config> {
    logger.trace(`core/layer1.ts - L1Contract::getConfig()`)
    if (this.config) return this.config
    /** test start */
    /** test ends */
    const [
      network,
      utxoTreeDepth,
      withdrawalTreeDepth,
      nullifierTreeDepth,
      challengePeriod,
      utxoSubTreeDepth,
      utxoSubTreeSize,
      withdrawalSubTreeDepth,
      withdrawalSubTreeSize,
      minimumStake,
      referenceDepth,
      maxUtxo,
      maxWithdrawal,
    ] = await Promise.all([
      this.provider.getNetwork(),
      ...[
        this.zkopru.UTXO_TREE_DEPTH(),
        this.zkopru.WITHDRAWAL_TREE_DEPTH(),
        this.zkopru.NULLIFIER_TREE_DEPTH(),
        this.zkopru.CHALLENGE_PERIOD(),
        this.zkopru.UTXO_SUB_TREE_DEPTH(),
        this.zkopru.UTXO_SUB_TREE_SIZE(),
        this.zkopru.WITHDRAWAL_SUB_TREE_DEPTH(),
        this.zkopru.WITHDRAWAL_SUB_TREE_SIZE(),
        this.zkopru.MINIMUM_STAKE(),
        this.zkopru.REF_DEPTH(),
        this.zkopru.MAX_UTXO(),
        this.zkopru.MAX_WITHDRAWAL(),
      ],
    ])

    const networkId = network.chainId // TODO add a amethod to specify network id
    const { chainId } = network
    const zkopruId = soliditySha3(
      hexify(networkId, 32),
      hexify(chainId, 32),
      hexify(this.address, 20),
    )
    if (!zkopruId) throw Error('hash error to get zkopru id')
    this.config = {
      id: zkopruId,
      networkId,
      chainId,
      address: this.address,
      utxoTreeDepth: utxoTreeDepth.toNumber(),
      withdrawalTreeDepth: withdrawalTreeDepth.toNumber(),
      nullifierTreeDepth: nullifierTreeDepth.toNumber(),
      utxoSubTreeDepth: utxoSubTreeDepth.toNumber(),
      utxoSubTreeSize: utxoSubTreeSize.toNumber(),
      withdrawalSubTreeDepth: withdrawalSubTreeDepth.toNumber(),
      withdrawalSubTreeSize: withdrawalSubTreeSize.toNumber(),
      challengePeriod: challengePeriod.toNumber(),
      minimumStake: minimumStake.toString(),
      referenceDepth: referenceDepth.toNumber(),
      maxUtxo: maxUtxo.toString(),
      maxWithdrawal: maxWithdrawal.toString(),
    }
    return this.config
  }
}
