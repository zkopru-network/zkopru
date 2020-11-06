import path from 'path'
import { loadKeys } from './testset-keys'

// eslint-disable-next-line prettier/prettier
const keyPath = path.join(path.dirname(__filename), '../keys');

// eslint-disable-next-line prettier/prettier
(async () => {
  await loadKeys(keyPath)
})().catch(e => {
  console.error(e)
})
