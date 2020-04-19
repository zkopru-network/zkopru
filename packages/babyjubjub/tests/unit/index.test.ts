import { Field } from '@zkopru/babyjubjub'

describe('unit test', () => {
  it('field', () => {
    expect.hasAssertions()
    const a = 3
    const b = new Field(3)
    console.log(b)
    expect(a).toBeGreaterThan(0)
    // expect(Field.from(1)).toBeDefined()
  })
})
