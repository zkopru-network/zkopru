/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable jest/no-hooks */
import { Docker } from 'node-docker-api'
import { Container } from 'node-docker-api/lib/container'
import * as snarkjs from 'snarkjs'
import * as ffjs from 'ffjavascript'
import * as utils from '~utils'
import { utxos } from '~dataset/testset-utxos'

describe('nullifier.circom', () => {
  let container: Container
  beforeAll(async () => {
    const docker = new Docker({ socketPath: '/var/run/docker.sock' })
    const containerName = Math.random()
      .toString(36)
      .substring(2, 16)
    try {
      container = await docker.container.create({
        Image: 'zkopru:circuits-test',
        name: containerName,
        rm: true,
      })
    } catch {
      container = docker.container.get(containerName)
    }
    await container.start()
  })
  afterAll(async () => {
    await container.stop()
    await container.delete()
  })
  describe('nullifier()', () => {
    it('should return same nullifier with its typescript version', async () => {
      const { wasm, pk, vk } = await utils.getZkSnarkParams(
        container,
        'nullifier.test.circom',
      )
      const utxo = utxos.utxo1_out_1
      const witness = await utils.calculateWitness(wasm, {
        note_hash: utxo.hash().toIden3BigInt(),
        note_salt: utxo.salt.toIden3BigInt(),
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
      expect(publicSignals[0].toString()).toStrictEqual(
        utxo.nullifier().toString(),
      )
    })
  })
  describe('nullifier from note details', () => {
    it('should return same nullifier with its typescript version', async () => {
      const { wasm, pk, vk } = await utils.getZkSnarkParams(
        container,
        'nullifier_from_note.test.circom',
      )
      const utxo = utxos.utxo1_out_1
      const witness = await utils.calculateWitness(wasm, {
        eth: utxo.eth.toIden3BigInt(),
        pubkey_x: utxo.pubKey.x.toIden3BigInt(),
        pubkey_y: utxo.pubKey.y.toIden3BigInt(),
        salt: utxo.salt.toIden3BigInt(),
        token_addr: utxo.tokenAddr.toIden3BigInt(),
        erc20: utxo.erc20Amount.toIden3BigInt(),
        nft: utxo.nft.toIden3BigInt(),
        note_hash: utxo.hash().toIden3BigInt(),
        nullifier: utxo.nullifier().toIden3BigInt(),
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
    })
  })
})
