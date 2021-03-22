import { Fp } from '@zkopru/babyjubjub'

describe('integration test', () => {
  it('field', () => {
    expect.hasAssertions()
    expect(Fp.from(1)).toBeDefined()
  })
})
