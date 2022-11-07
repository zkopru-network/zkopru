describe('tx builder', () => {
  beforeAll(async () => {})

  describe('single asset utxo in, single asset utxo out', () => {
    it('IN: 1 ETH utxo, OUT: ETH utxo', async () => {})
    it('IN: 1 ERC20 utxo and ETH utxo, OUT: 1 ERC20 utxo', async () => {})
    it('IN: 1 ERC20 utxo, OUT: ERC20 utxo. This should be failed bcs no ether for gas fee', async () => {})
    it('IN: 2 ETH utxos, OUT: ETH utxo', async () => {})
    it('IN: 2 ERC20 utxo and ETH utxo, OUT: 1 ERC20 utxo', async () => {})
  })

  describe('single asset utxo in, combined asset utxo out', () => {
    it('IN: 2 ETH Utxos and 1 ERC20 Utxo, OUT: (ETH + ERC20) utxo', async () => {})
    it('IN: 1 ETH Utxos and 2 ERC20 Utxo, OUT: (ETH + ERC20) utxo', async () => {})
  })

  describe('combined asset utxo in, single asset utxo out', () => {
    it('IN: 1 (ETH + ERC20) utxo, OUT: ETH utxo', async () => {})
    it('IN: 1 (ETH + ERC20) utxo, OUT: ERC20 utxo', async () => {})
    it('IN: 1 (ETH + ERC20) utxo and 1 ERC20 utxo, OUT: ETH utxo', async () => {})
    it('IN: 1 (ETH + ERC20) utxo and 1 ERC20 utxo, OUT: ERC20 utxo', async () => {})
    it('IN: 1 (ETH + ERC20) utxo and 1 ETH utxo, OUT: ETH utxo', async () => {})
    it('IN: 1 (ETH + ERC20) utxo and 1 ETH utxo, OUT: ERC20 utxo', async () => {})
  })

  describe('combined asset utxo in, combined asset utxo out', () => {
    it('IN: 1 (ETH + ERC20) utxo and 1 ERC20 utxo, OUT: (ETH + ERC20) utxo', async () => {})
    it('IN: 1 (ETH + ERC20) utxo and 1 ETH utxo, OUT: (ETH + ERC20) utxo', async () => {})
  })
})
