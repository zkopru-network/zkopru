import { getDummyBody } from './testset-block'

// eslint-disable-next-line prettier/prettier
(async () => {
  await getDummyBody()
})().catch(e => {
  console.error(e)
})
