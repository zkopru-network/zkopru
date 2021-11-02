import { getDummyBlock } from './testset-block'

// eslint-disable-next-line prettier/prettier
(async () => {
  await getDummyBlock()
})().catch(e => {
  console.error(e)
})
