import path from 'path'
import fs from 'fs'
import * as utils from '@zkopru/utils'

async function loadArtifacts() {
  // It may take about an hour. If you want to skip building image,
  // run `yarn pull:images` on the root directory
  const container = await utils.pullOrBuildAndGetContainer({
    compose: [__dirname, '../../../dockerfiles'],
    service: 'circuits-phase-1',
  })
  const ptauDir = path.join(path.dirname(__filename), '../build/ptau')
  const ptauPath = path.join(ptauDir, 'pot17_final.ptau')
  if (!fs.existsSync(ptauDir)) fs.mkdirSync(ptauDir, { recursive: true })
  await utils.copyFromContainer(
    container,
    `/proj/build/ptau/pot17_final.ptau`,
    ptauPath,
  )
  await container.stop()
  await container.delete()
}

// eslint-disable-next-line prettier/prettier
(async () => {
  console.log(
    'Pulling ptau phase 1 key from docker hub. This covers 131072 contraints in maximum',
  )
  await loadArtifacts()
})().catch(e => {
  console.error(e)
})
