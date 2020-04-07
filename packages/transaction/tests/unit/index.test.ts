import { Field } from '@zkopru/babyjubjub'

describe('unit test', () => {
  it('field', () => {
    expect.hasAssertions()
    expect(Field.from(1)).toBeDefined()
  })
})
