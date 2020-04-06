import { Field } from '@zkopru/babyjubjub'

describe('integration test', () => {
  it('field', () => {
    expect.hasAssertions()
    expect(Field.from(1)).toBeDefined()
  })
})
