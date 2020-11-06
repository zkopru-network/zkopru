/* eslint-disable @typescript-eslint/camelcase */
import fs from 'fs-extra'
import path from 'path'
import * as utils from '@zkopru/utils'
import tar from 'tar'

export async function loadCircuits() {
  // It may take about an hour. If you want to skip building image,
  // run `yarn pull:images` on the root directory
  const container = await utils.pullOrBuildAndGetContainer({
    compose: [__dirname, '../../../dockerfiles'],
    service: 'circuits',
  })
  const nIn = [1, 2, 3, 4]
  const nOut = [1, 2, 3, 4]
  const keyPath = path.join(path.dirname(__filename), '../keys')
  const zkeyPath = path.join(keyPath, 'zkeys')
  const vkPath = path.join(keyPath, 'vks')
  const ccPath = path.join(keyPath, 'circuits')
  if (!fs.existsSync(zkeyPath)) await fs.mkdirp(zkeyPath)
  if (!fs.existsSync(vkPath)) await fs.mkdirp(vkPath)
  if (!fs.existsSync(ccPath)) await fs.mkdirp(ccPath)
  for (const i of nIn) {
    for (const o of nOut) {
      const circuit = await utils.readFromContainer(
        container,
        `/proj/build/circuits/zk_transaction_${i}_${o}.wasm`,
      )
      const zkey = await utils.readFromContainer(
        container,
        `/proj/build/zkeys/zk_transaction_${i}_${o}.final.zkey`,
      )
      const vk = await utils.readFromContainer(
        container,
        `/proj/build/vks/zk_transaction_${i}_${o}.vk.json`,
      )
      fs.writeFileSync(
        path.join(ccPath, `zk_transaction_${i}_${o}.wasm`),
        circuit,
      )
      fs.writeFileSync(
        path.join(zkeyPath, `zk_transaction_${i}_${o}.zkey`),
        zkey,
      )
      fs.writeFileSync(
        path.join(vkPath, `zk_transaction_${i}_${o}.vk.json`),
        vk,
      )
    }
  }
  await container.stop()
  await container.delete()
}

export async function loadKeys(keyPath: string) {
  if (!fs.existsSync(keyPath)) {
    loadCircuits()
      .then(() => {
        tar
          .c({}, ['keys/zkeys', 'keys/vks', 'keys/circuits'])
          .pipe(fs.createWriteStream('keys.tgz'))
      })
      .catch(console.error)
  }
}
