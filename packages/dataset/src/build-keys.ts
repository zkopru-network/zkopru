import path from 'path'
import { buildKeys } from './testset-zktxs'

// eslint-disable-next-line prettier/prettier
(async () => {
  const keyPath = path.join(path.dirname(__filename), '../keys')
  await buildKeys(keyPath)
})().catch(e => {
  console.error(e)
})
