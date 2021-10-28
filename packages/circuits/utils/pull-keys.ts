import path from 'path'
import { getKeysFromContainer } from './key-builder'

// eslint-disable-next-line prettier/prettier
(async () => {
  const keyPath = path.join(path.dirname(__filename), '../keys')
  await getKeysFromContainer(keyPath, { build: false })
})().catch(e => {
  console.error(e)
})
