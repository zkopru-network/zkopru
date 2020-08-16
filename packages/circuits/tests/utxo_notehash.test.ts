/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable jest/no-hooks */
import { Container } from 'node-docker-api/lib/container'
import * as snarkjs from 'snarkjs'
import * as ffjs from 'ffjavascript'
import { getZkSnarkParams, calculateWitness } from '~utils/snark'
import { buildAndGetContainer } from '~utils/docker'
import { utxos } from '~dataset/testset-utxos'
import { accounts } from '~dataset/testset-keys'
import { Field } from '~babyjubjub/field'

describe('utxo_notehash.test.circom', () => {
  let container: Container
  beforeAll(async () => {
    // It may take about few minutes. If you want to skip building image,
    // run `yarn pull:images` on the root directory
    container = await buildAndGetContainer({
      compose: [__dirname, '../../../dockerfiles'],
      service: 'circuits-test',
    })
    await container.start()
  }, 3600000)
  afterAll(async () => {
    await container.stop()
    await container.delete()
  }, 60000)
  describe('utxo note hash()', () => {
    it('should return same hash with its typescript version', async () => {
      const { wasm, pk, vk } = await getZkSnarkParams(
        container,
        'utxo_notehash.test.circom',
      )
      const utxo = utxos.utxo1_out_1
      const account = accounts.bob
      const eddsa = account.signEdDSA(utxo.hash())
      const witness = await calculateWitness(wasm, {
        pG_x: account.getEdDSAPoint().x.toIden3BigInt(),
        pG_y: account.getEdDSAPoint().y.toIden3BigInt(),
        sig_r8x: eddsa.R8.x.toIden3BigInt(),
        sig_r8y: eddsa.R8.y.toIden3BigInt(),
        sig_s: eddsa.S.toIden3BigInt(),
        nullifier_seed: account.getNullifierSeed().toIden3BigInt(),
        salt: utxo.salt.toIden3BigInt(),
        eth: utxo.eth().toIden3BigInt(),
        token_addr: utxo.tokenAddr().toIden3BigInt(),
        erc20: utxo.erc20Amount().toIden3BigInt(),
        erc721: utxo.nft().toIden3BigInt(),
        leaf_index: Field.from(32).toIden3BigInt(),
        note_hash: utxo.hash().toIden3BigInt(),
        nullifier: utxo
          .nullifier(account.getNullifierSeed(), Field.from(32))
          .toIden3BigInt(),
      })
      const { proof, publicSignals } = snarkjs.groth.genProof(
        ffjs.utils.unstringifyBigInts(pk),
        ffjs.utils.unstringifyBigInts(ffjs.utils.stringifyBigInts(witness)),
      )
      const isValid = snarkjs.groth.isValid(
        ffjs.utils.unstringifyBigInts(vk),
        ffjs.utils.unstringifyBigInts(proof),
        ffjs.utils.unstringifyBigInts(publicSignals),
      )
      expect(isValid).toStrictEqual(true)
      expect(publicSignals[0].toString()).toStrictEqual(utxo.hash().toString())
    }, 30000)
  })
})
