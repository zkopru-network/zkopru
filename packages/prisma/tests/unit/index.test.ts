describe('database test', () => {
  it('dummy', () => {
    const a = 0
    expect(a).toBeDefined()
  })
  it.todo('should handle database busy error gracefully')
  it.todo('should support batch write using db transaction')
})
