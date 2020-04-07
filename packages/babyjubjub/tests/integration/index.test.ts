import { Field } from '~babyjubjub'

describe('integration test', () => {
  it('field', () => {
    expect.hasAssertions()
    expect(Field.from(1)).toBeDefined()
  })
})
