import path from 'path'
import fs from 'fs'
import tar from 'tar'
import * as utils from '@zkopru/utils'

async function loadArtifacts(build?: boolean) {
  // It may take about an hour. If you want to skip building image,
  // run `yarn pull:images` on the root directory
  const loader = build ? utils.buildAndGetContainer : utils.pullAndGetContainer
  const container = await loader({
    compose: [__dirname, '../../../dockerfiles'],
    service: 'circuits',
  })
  const nIn = [1, 2, 3, 4]
  const nOut = [1, 2, 3, 4]
  const artifactsPath = path.join(path.dirname(__filename), '../keys')
  const zkeyDir = path.join(artifactsPath, 'zkeys')
  const vkDir = path.join(artifactsPath, 'vks')
  const wasmDir = path.join(artifactsPath, 'circuits')
  if (!fs.existsSync(zkeyDir)) fs.mkdirSync(zkeyDir, { recursive: true })
  if (!fs.existsSync(vkDir)) fs.mkdirSync(vkDir, { recursive: true })
  if (!fs.existsSync(wasmDir)) fs.mkdirSync(wasmDir, { recursive: true })
  for (const i of nIn) {
    for (const o of nOut) {
      await utils.copyFromContainer(
        container,
        `/proj/build/circuits/zk_transaction_${i}_${o}.wasm`,
        path.join(wasmDir, `zk_transaction_${i}_${o}.wasm`),
      )
      await utils.copyFromContainer(
        container,
        `/proj/build/zkeys/zk_transaction_${i}_${o}.final.zkey`,
        path.join(zkeyDir, `zk_transaction_${i}_${o}.zkey`),
      )
      await utils.copyFromContainer(
        container,
        `/proj/build/vks/zk_transaction_${i}_${o}.vk.json`,
        path.join(vkDir, `zk_transaction_${i}_${o}.vk.json`),
      )
    }
  }
  await container.stop()
  await container.delete()
}

/**
 * Get SNARK keys from docker container.
 * @param artifactsPath Path to store zk snark keys
 * @param build If the value is true, it builds a new image to get the snark keys.
 *  Otherwise it'll try to pull an exising image from the docker hub.
 */
export async function getKeysFromContainer(
  artifactsPath: string,
  option?: { build?: boolean },
) {
  if (!fs.existsSync(artifactsPath)) {
    loadArtifacts(option?.build)
      .then(() => {
        tar
          .c({}, ['keys/zkeys', 'keys/vks', 'keys/circuits'])
          .pipe(fs.createWriteStream('keys.tgz'))
      })
      .catch(console.error)
  }
}
