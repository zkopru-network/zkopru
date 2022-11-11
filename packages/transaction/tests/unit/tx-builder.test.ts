import { ZkAccount } from '@zkopru/account/src/account'
import { Fp } from '@zkopru/babyjubjub'
import { Note, TxBuilder, Utxo } from '@zkopru/transaction'
import { parseUnits, parseEther } from 'ethers/lib/utils'
import { Address } from 'soltypes'

describe('tx builder', () => {
  const ERC20_ADDR = '0x254dffcd3277C0b1660F6d42EFbB754edaBAbC2B'
  const GAS_PRICE = parseUnits('1', 'gwei')
  let alice: ZkAccount
  let bob: ZkAccount
  let txBuilder: TxBuilder

  function generateUtxo(ethAmount: string, erc20Amount: string): Utxo {
    return Utxo.from(
      new Note(alice.zkAddress, Fp.from('123456'), {
        eth: Fp.from(parseEther(ethAmount.toString())),
        tokenAddr: Fp.from(Address.from(ERC20_ADDR).toBigNumber()),
        erc20Amount: Fp.from(parseEther(erc20Amount.toString())),
        nft: Fp.from('0'),
      }),
    )
  }
  beforeEach(async () => {
    alice = new ZkAccount(
      '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d',
      '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1',
    )
    bob = new ZkAccount(
      '0xc2abfb7847699c9d47419b59ca1050355bc05aef461a3afcf590ffb52c531397',
      '0xF66F7Ae5D3D87802eee8f4B67411b15b1a60A7D4',
    )
    txBuilder = TxBuilder.from(alice.zkAddress).weiPerByte(GAS_PRICE)
  })

  describe('single asset utxo in, single asset utxo out', () => {
    it('IN: 1 ETH utxo, SPENT: ETH', async () => {
      // gen a 1ETH utxo
      const utxo = generateUtxo('1', '0')
      const rawTx = txBuilder
        .provide(utxo)
        .sendEther({ eth: Fp.from(parseEther('0.5')), to: bob.zkAddress })
        .build()

      // check inflow
      expect(rawTx.inflow.length).toEqual(1)
      expect(rawTx.inflow[0].asset.eth.toString()).toEqual(
        parseEther('1').toString(),
      )
      // check outflow
      expect(rawTx.outflow.length).toEqual(2)
      expect(rawTx.outflow[0].asset.eth.toString()).toEqual(
        parseEther('0.5').toString(),
      )
      expect(rawTx.outflow[0].owner).toEqual(bob.zkAddress)
      expect(rawTx.fee.toString()).toEqual(parseUnits('470', 'gwei').toString())
      expect(rawTx.outflow[1].asset.eth.toString()).toEqual(
        parseEther('0.5')
          .sub(parseUnits('470', 'gwei'))
          .toString(),
      )
      expect(rawTx.outflow[1].owner).toEqual(alice.zkAddress)
    })

    it('IN: 1 ERC20 utxo and ETH utxo, SPENT: ERC20', async () => {
      // gen a 100 ERC20 utxo and a 1 ETH utxo
      const utxoERC20 = generateUtxo('0', '100')
      const utxoETH = generateUtxo('1', '0')
      const rawTx = txBuilder
        .provide(utxoERC20)
        .provide(utxoETH)
        .sendERC20({
          tokenAddr: ERC20_ADDR,
          erc20Amount: Fp.from(parseEther('30')),
          to: bob.zkAddress,
        })
        .build()

      // check inflow
      expect(rawTx.inflow.length).toEqual(2)
      expect(rawTx.inflow[1].asset.eth.toString()).toEqual(
        parseEther('1').toString(),
      )
      expect(rawTx.inflow[0].asset.erc20Amount.toString()).toEqual(
        parseEther('100').toString(),
      )
      // check outflow
      // 0: erc20 utxo for Bob, 1: erc20 utxo for Alice and 2: eth utxo for Alice
      expect(rawTx.outflow.length).toEqual(3)
      expect(rawTx.outflow[0].asset.erc20Amount.toString()).toEqual(
        parseEther('30').toString(),
      )
      expect(rawTx.outflow[0].asset.eth.toString()).toEqual('0')
      expect(rawTx.outflow[0].owner).toEqual(bob.zkAddress)
      expect(rawTx.outflow[1].owner).toEqual(alice.zkAddress)
      expect(rawTx.outflow[1].asset.eth.toString()).toEqual(
        parseEther('1')
          .sub(parseUnits('567', 'gwei'))
          .toString(),
      )
      expect(rawTx.outflow[2].asset.eth.toString()).toEqual('0')
      expect(rawTx.outflow[2].asset.erc20Amount.toString()).toEqual(
        parseEther('70').toString(),
      )
      expect(rawTx.outflow[2].owner).toEqual(alice.zkAddress)
      expect(rawTx.fee.toString()).toEqual(parseUnits('567', 'gwei').toString())
    })
    it('IN: 1 ERC20 utxo, SPENT: ERC20. This should be failed bcs no ether for gas fee', async () => {
      // gen a 100 ERC20 utxo only
      const utxoERC20 = generateUtxo('0', '100')
      const builder = txBuilder.provide(utxoERC20).sendERC20({
        tokenAddr: ERC20_ADDR,
        erc20Amount: Fp.from(parseEther('30')),
        to: bob.zkAddress,
      })

      try {
        builder.build()
      } catch (err) {
        expect((err as Error).message).toContain(
          'Not enough Ether. Insufficient:',
        )
      }
    })
    it('IN: 2 ETH utxos, SPENT: ETH and should only spend the utxo with 1 ETH', async () => {
      // gen a 10 ETH utxo and a 1 ETH utxo
      const utxoETH10 = generateUtxo('10', '0')
      const utxoETH = generateUtxo('1', '0')
      const rawTx = txBuilder
        .provide(utxoETH10)
        .provide(utxoETH)
        .sendEther({
          eth: Fp.from(parseEther('0.5')),
          to: bob.zkAddress,
        })
        .build()

      // check inflow
      expect(rawTx.inflow.length).toEqual(1)
      expect(rawTx.inflow[0].asset.eth.toString()).toEqual(
        parseEther('1').toString(),
      )

      // check outflow
      expect(rawTx.outflow.length).toEqual(2)
      expect(rawTx.outflow[0].asset.eth.toString()).toEqual(
        parseEther('0.5').toString(),
      )
      expect(rawTx.outflow[0].owner).toEqual(bob.zkAddress)
      expect(rawTx.fee.toString()).toEqual(parseUnits('470', 'gwei').toString())
      expect(rawTx.outflow[1].asset.eth.toString()).toEqual(
        parseEther('0.5')
          .sub(parseUnits('470', 'gwei'))
          .toString(),
      )
      expect(rawTx.outflow[1].owner).toEqual(alice.zkAddress)
    })
    it('IN: 2 ETH utxos, SPENT: ETH and should only spend the utxo with 10 ETH', async () => {
      // gen a 10 ETH utxo and a 1 ETH utxo
      const utxoETH10 = generateUtxo('10', '0')
      const utxoETH = generateUtxo('1', '0')
      const rawTx = txBuilder
        .provide(utxoETH10)
        .provide(utxoETH)
        .sendEther({
          eth: Fp.from(parseEther('5')),
          to: bob.zkAddress,
        })
        .build()

      // check inflow
      expect(rawTx.inflow.length).toEqual(1)
      expect(rawTx.inflow[0].hash()).toEqual(utxoETH10.hash())

      // check outflow
      expect(rawTx.outflow.length).toEqual(2)
      expect(rawTx.outflow[0].asset.eth.toString()).toEqual(
        parseEther('5').toString(),
      )
      expect(rawTx.outflow[0].owner).toEqual(bob.zkAddress)
      expect(rawTx.fee.toString()).toEqual(parseUnits('470', 'gwei').toString())
      expect(rawTx.outflow[1].asset.eth.toString()).toEqual(
        parseEther('5')
          .sub(parseUnits('470', 'gwei'))
          .toString(),
      )
      expect(rawTx.outflow[1].owner).toEqual(alice.zkAddress)
    })

    it('IN: 2 ETH utxos, SPENT: ETH and spent both of utxos', async () => {
      // gen a 10 ETH utxo and a 1 ETH utxo
      const utxoETH10 = generateUtxo('10', '0')
      const utxoETH = generateUtxo('1', '0')
      const rawTx = txBuilder
        .provide(utxoETH10)
        .provide(utxoETH)
        .sendEther({
          eth: Fp.from(parseEther('10.5')),
          to: bob.zkAddress,
        })
        .build()

      // check inflow
      expect(rawTx.inflow.length).toEqual(2)

      // check outflow
      expect(rawTx.outflow.length).toEqual(2)
      expect(rawTx.outflow[0].asset.eth.toString()).toEqual(
        parseEther('10.5').toString(),
      )
      expect(rawTx.outflow[0].owner).toEqual(bob.zkAddress)
      expect(rawTx.fee.toString()).toEqual(parseUnits('534', 'gwei').toString())
      expect(rawTx.outflow[1].asset.eth.toString()).toEqual(
        parseEther('0.5')
          .sub(parseUnits('534', 'gwei'))
          .toString(),
      )
      expect(rawTx.outflow[1].owner).toEqual(alice.zkAddress)
    })

    it('IN: 2 ERC20 utxo and ETH utxo, SPENT: ERC20 and only spent one of ERC20 utxos', async () => {
      const utxoERC20 = generateUtxo('0', '100')
      const utxoERC20_2 = generateUtxo('0', '200')
      const utxoETH = generateUtxo('1', '0')
      const rawTx = txBuilder
        .provide(utxoERC20)
        .provide(utxoERC20_2)
        .provide(utxoETH)
        .sendERC20({
          tokenAddr: ERC20_ADDR,
          erc20Amount: Fp.from(parseEther('30')),
          to: bob.zkAddress,
        })
        .build()

      // check inflow
      expect(rawTx.inflow.length).toEqual(2)
      expect(rawTx.inflow[1].asset.eth.toString()).toEqual(
        parseEther('1').toString(),
      )
      expect(rawTx.inflow[0].asset.erc20Amount.toString()).toEqual(
        parseEther('100').toString(),
      )
      // check outflow
      expect(rawTx.outflow.length).toEqual(3)
      expect(rawTx.outflow[0].asset.erc20Amount.toString()).toEqual(
        parseEther('30').toString(),
      )
      expect(rawTx.outflow[0].asset.eth.toString()).toEqual('0')
      expect(rawTx.outflow[0].owner).toEqual(bob.zkAddress)
      expect(rawTx.fee.toString()).toEqual(parseUnits('567', 'gwei').toString())
      expect(rawTx.outflow[1].asset.eth.toString()).toEqual(
        parseEther('1')
          .sub(parseUnits('567', 'gwei'))
          .toString(),
      )
      expect(rawTx.outflow[1].asset.erc20Amount.toString()).toEqual('0')
      expect(rawTx.outflow[1].owner).toEqual(alice.zkAddress)
      expect(rawTx.outflow[2].asset.eth.toString()).toEqual('0')
      expect(rawTx.outflow[2].asset.erc20Amount.toString()).toEqual(
        parseEther('70').toString(),
      )
      expect(rawTx.outflow[2].owner).toEqual(alice.zkAddress)
    })

    it('IN: 2 ERC20 utxo and ETH utxo, SPENT: ERC20 and spent both of ERC20 utxos', async () => {
      const utxoERC20 = generateUtxo('0', '100')
      const utxoERC20_2 = generateUtxo('0', '200')
      const utxoETH = generateUtxo('1', '0')
      const rawTx = txBuilder
        .provide(utxoERC20)
        .provide(utxoERC20_2)
        .provide(utxoETH)
        .sendERC20({
          tokenAddr: ERC20_ADDR,
          erc20Amount: Fp.from(parseEther('230')),
          to: bob.zkAddress,
        })
        .build()

      // check inflow
      expect(rawTx.inflow.length).toEqual(3)
      expect(rawTx.inflow[0].asset.eth.toString()).toEqual(
        parseEther('1').toString(),
      )
      expect(rawTx.inflow[1].asset.erc20Amount.toString()).toEqual(
        parseEther('100').toString(),
      )
      expect(rawTx.inflow[2].asset.erc20Amount.toString()).toEqual(
        parseEther('200').toString(),
      )
      // check outflow
      expect(rawTx.outflow.length).toEqual(3)
      expect(rawTx.outflow[0].asset.erc20Amount.toString()).toEqual(
        parseEther('230').toString(),
      )
      expect(rawTx.outflow[0].asset.eth.toString()).toEqual('0')
      expect(rawTx.outflow[0].owner).toEqual(bob.zkAddress)
      expect(rawTx.fee.toString()).toEqual(parseUnits('631', 'gwei').toString())
      expect(rawTx.outflow[1].owner).toEqual(alice.zkAddress)
      expect(rawTx.outflow[1].asset.eth.toString()).toEqual(
        parseEther('1')
          .sub(parseUnits('631', 'gwei'))
          .toString(),
      )
      expect(rawTx.outflow[2].asset.eth.toString()).toEqual('0')
      expect(rawTx.outflow[2].asset.erc20Amount.toString()).toEqual(
        parseEther('70').toString(),
      )
    })
  })

  describe('single asset utxo in, combined asset utxo out', () => {
    it('IN: 2 ETH Utxos and 1 ERC20 Utxo, SPENT: (ETH + ERC20) and only 1 ETH utxo was used', async () => {
      const utxoERC20 = generateUtxo('0', '100')
      const utxoETH = generateUtxo('1', '0')
      const utxoETH10 = generateUtxo('10', '0')
      const rawTx = txBuilder
        .provide(utxoERC20)
        .provide(utxoETH10)
        .provide(utxoETH)
        .sendERC20({
          tokenAddr: ERC20_ADDR,
          erc20Amount: Fp.from(parseEther('50')),
          to: bob.zkAddress,
        })
        .sendEther({ eth: Fp.from(parseEther('0.5')), to: bob.zkAddress })
        .build()

      // check inflow
      expect(rawTx.inflow.length).toEqual(2)
      expect(rawTx.inflow[0].hash()).toEqual(utxoERC20.hash())
      expect(rawTx.inflow[1].hash()).toEqual(utxoETH.hash())

      // check outflow
      expect(rawTx.outflow.length).toEqual(4)
      expect(rawTx.outflow[0].asset.erc20Amount.toString()).toEqual(
        parseEther('50').toString(),
      )
      expect(rawTx.outflow[0].asset.eth.toString()).toEqual('0')
      expect(rawTx.outflow[0].owner).toEqual(bob.zkAddress)
      expect(rawTx.outflow[1].asset.erc20Amount.toString()).toEqual('0')
      expect(rawTx.outflow[1].asset.eth.toString()).toEqual(
        parseEther('0.5').toString(),
      )
      expect(rawTx.outflow[1].owner).toEqual(bob.zkAddress)
      expect(rawTx.fee.toString()).toEqual(parseUnits('600', 'gwei').toString())
      expect(rawTx.outflow[2].owner).toEqual(alice.zkAddress)
      expect(rawTx.outflow[2].asset.eth.toString()).toEqual(
        parseEther('0.5')
          .sub(parseUnits('600', 'gwei'))
          .toString(),
      )
      expect(rawTx.outflow[2].asset.erc20Amount.toString()).toEqual('0')
      expect(rawTx.outflow[3].asset.erc20Amount.toString()).toEqual(
        parseEther('50').toString(),
      )
      expect(rawTx.outflow[3].asset.eth.toString()).toEqual('0')
      expect(rawTx.outflow[3].owner).toEqual(alice.zkAddress)
    })
    it('IN: 2 ETH Utxos and 1 ERC20 Utxo, SPENT: (ETH + ERC20) and 2 ETH utxos were used', async () => {
      const utxoERC20 = generateUtxo('0', '100')
      const utxoETH = generateUtxo('1', '0')
      const utxoETH10 = generateUtxo('10', '0')
      const rawTx = txBuilder
        .provide(utxoERC20)
        .provide(utxoETH10)
        .provide(utxoETH)
        .sendERC20({
          tokenAddr: ERC20_ADDR,
          erc20Amount: Fp.from(parseEther('50')),
          to: bob.zkAddress,
        })
        .sendEther({ eth: Fp.from(parseEther('10.5')), to: bob.zkAddress })
        .build()

      // check inflow
      expect(rawTx.inflow.length).toEqual(3)

      // check outflow
      expect(rawTx.outflow.length).toEqual(4)
      expect(rawTx.outflow[0].asset.erc20Amount.toString()).toEqual(
        parseEther('50').toString(),
      )
      expect(rawTx.outflow[1].asset.eth.toString()).toEqual(
        parseEther('10.5').toString(),
      )
      expect(rawTx.outflow[0].owner).toEqual(bob.zkAddress)
      expect(rawTx.outflow[1].owner).toEqual(bob.zkAddress)

      expect(rawTx.fee.toString()).toEqual(parseUnits('664', 'gwei').toString())
      expect(rawTx.outflow[2].asset.eth.toString()).toEqual(
        parseEther('0.5')
          .sub(parseUnits('664', 'gwei'))
          .toString(),
      )
      expect(rawTx.outflow[2].asset.erc20Amount.toString()).toEqual('0')
      expect(rawTx.outflow[2].owner).toEqual(alice.zkAddress)
      expect(rawTx.outflow[3].asset.eth.toString()).toEqual('0')
      expect(rawTx.outflow[3].asset.erc20Amount.toString()).toEqual(
        parseEther('50').toString(),
      )

      expect(rawTx.outflow[3].owner).toEqual(alice.zkAddress)
    })

    it('IN: 1 ETH Utxos and 2 ERC20 Utxo, SPENT: (ETH + ERC20)', async () => {
      const utxoERC20 = generateUtxo('0', '100')
      const utxoERC20_2 = generateUtxo('0', '200')
      const utxoETH = generateUtxo('1', '0')
      const rawTx = txBuilder
        .provide(utxoERC20)
        .provide(utxoERC20_2)
        .provide(utxoETH)
        .sendERC20({
          tokenAddr: ERC20_ADDR,
          erc20Amount: Fp.from(parseEther('50')),
          to: bob.zkAddress,
        })
        .build()

      // check inflow
      expect(rawTx.inflow.length).toEqual(2)
      expect(rawTx.inflow[0].hash()).toEqual(utxoERC20.hash())
      expect(rawTx.inflow[1].hash()).toEqual(utxoETH.hash())

      // check outflow
      expect(rawTx.outflow.length).toEqual(3)
      expect(rawTx.outflow[0].asset.erc20Amount.toString()).toEqual(
        parseEther('50').toString(),
      )
      expect(rawTx.outflow[0].asset.eth.toString()).toEqual('0')
      expect(rawTx.outflow[0].owner).toEqual(bob.zkAddress)

      expect(rawTx.fee.toString()).toEqual(parseUnits('567', 'gwei').toString())
      expect(rawTx.outflow[1].owner).toEqual(alice.zkAddress)
      expect(rawTx.outflow[1].asset.eth.toString()).toEqual(
        parseEther('1')
          .sub(parseUnits('567', 'gwei'))
          .toString(),
      )
      expect(rawTx.outflow[1].asset.erc20Amount.toString()).toEqual('0')
      expect(rawTx.outflow[2].asset.eth.toString()).toEqual('0')
      expect(rawTx.outflow[2].asset.erc20Amount.toString()).toEqual(
        parseEther('50').toString(),
      )
      expect(rawTx.outflow[2].owner).toEqual(alice.zkAddress)
    })
  })

  describe('combined asset utxo in, single asset utxo out', () => {
    it('IN: 1 (ETH + ERC20) utxo, SPENT: ETH', async () => {
      const utxo = generateUtxo('1', '100')
      const rawTx = txBuilder
        .provide(utxo)
        .sendEther({
          eth: Fp.from(parseEther('0.5')),
          to: bob.zkAddress,
        })
        .build()

      // check inflow
      expect(rawTx.inflow.length).toEqual(1)
      expect(rawTx.inflow[0].hash()).toEqual(utxo.hash())

      // check outflow
      // 0: (eth + erc20) utxo for Bob, 1: eth utxo for Alice and 2: erc20 utxo for Alice
      expect(rawTx.outflow.length).toEqual(3)
      expect(rawTx.outflow[0].asset.eth.toString()).toEqual(
        parseEther('0.5').toString(),
      )
      expect(rawTx.outflow[0].asset.erc20Amount.toString()).toEqual('0')
      expect(rawTx.outflow[0].owner).toEqual(bob.zkAddress)

      expect(rawTx.fee.toString()).toEqual(parseUnits('503', 'gwei').toString())
      expect(rawTx.outflow[1].asset.eth.toString()).toEqual(
        parseEther('0.5')
          .sub(parseUnits('503', 'gwei'))
          .toString(),
      )
      expect(rawTx.outflow[1].asset.erc20Amount.toString()).toEqual('0')
      expect(rawTx.outflow[1].owner).toEqual(alice.zkAddress)
      expect(rawTx.outflow[2].asset.eth.toString()).toEqual('0')
      expect(rawTx.outflow[2].asset.erc20Amount.toString()).toEqual(
        parseEther('100').toString(),
      )
      expect(rawTx.outflow[2].owner).toEqual(alice.zkAddress)
    })
    it('IN: 1 (ETH + ERC20) utxo, SPENT: ERC20', async () => {
      const utxo = generateUtxo('1', '100')
      const rawTx = txBuilder
        .provide(utxo)
        .sendERC20({
          tokenAddr: ERC20_ADDR,
          erc20Amount: Fp.from(parseEther('50')),
          to: bob.zkAddress,
        })
        .build()

      // check inflow
      expect(rawTx.inflow.length).toEqual(1)
      expect(rawTx.inflow[0].hash()).toEqual(utxo.hash())

      // check outflow
      // 0: (eth + erc20) utxo for Bob, 1: eth utxo for Alice and 2: erc20 utxo for Alice
      expect(rawTx.outflow.length).toEqual(3)
      expect(rawTx.outflow[0].asset.erc20Amount.toString()).toEqual(
        parseEther('50').toString(),
      )
      expect(rawTx.outflow[0].asset.eth.toString()).toEqual('0')
      expect(rawTx.outflow[0].owner).toEqual(bob.zkAddress)

      expect(rawTx.fee.toString()).toEqual(parseUnits('503', 'gwei').toString())
      expect(rawTx.outflow[1].asset.eth.toString()).toEqual(
        parseEther('1')
          .sub(parseUnits('503', 'gwei'))
          .toString(),
      )
      expect(rawTx.outflow[1].asset.erc20Amount.toString()).toEqual('0')
      expect(rawTx.outflow[1].owner).toEqual(alice.zkAddress)
      expect(rawTx.outflow[2].asset.eth.toString()).toEqual('0')
      expect(rawTx.outflow[2].asset.erc20Amount.toString()).toEqual(
        parseEther('50').toString(),
      )
      expect(rawTx.outflow[2].owner).toEqual(alice.zkAddress)
    })
    // do we need to merge changes?
    it('IN: 1 (ETH + ERC20) utxo and 1 ERC20 utxo, SPENT: ERC20', async () => {
      const utxo = generateUtxo('1', '100')
      const utxoERC20 = generateUtxo('0', '200')
      const rawTx = txBuilder
        .provide(utxo)
        .provide(utxoERC20)
        .sendERC20({
          tokenAddr: ERC20_ADDR,
          erc20Amount: Fp.from(parseEther('150')),
          to: bob.zkAddress,
        })
        .build()

      // check inflow
      expect(rawTx.inflow.length).toEqual(2)

      // check outflow
      expect(rawTx.outflow.length).toEqual(3)
      expect(rawTx.outflow[0].asset.erc20Amount.toString()).toEqual(
        parseEther('150').toString(),
      )
      expect(rawTx.outflow[0].asset.eth.toString()).toEqual('0')
      expect(rawTx.outflow[0].owner).toEqual(bob.zkAddress)

      expect(rawTx.fee.toString()).toEqual(parseUnits('567', 'gwei').toString())
      expect(rawTx.outflow[1].asset.eth.toString()).toEqual(
        parseEther('1')
          .sub(parseUnits('567', 'gwei'))
          .toString(),
      )
      expect(rawTx.outflow[1].asset.erc20Amount.toString()).toEqual('0')
      expect(rawTx.outflow[1].owner).toEqual(alice.zkAddress)
      expect(rawTx.outflow[2].asset.eth.toString()).toEqual('0')
      expect(rawTx.outflow[2].asset.erc20Amount.toString()).toEqual(
        parseEther('150').toString(),
      )

      expect(rawTx.outflow[2].owner).toEqual(alice.zkAddress)
    })
    it('IN: 1 (ETH + ERC20) utxo and 1 ETH utxo, SPENT: ETH and the utxo is the combination one', async () => {
      const utxo = generateUtxo('1', '100')
      const utxoETH = generateUtxo('2', '0')
      const rawTx = txBuilder
        .provide(utxo)
        .provide(utxoETH)
        .sendEther({
          eth: Fp.from(parseEther('0.5')),
          to: bob.zkAddress,
        })
        .build()

      // check inflow
      expect(rawTx.inflow.length).toEqual(1)
      expect(rawTx.inflow[0].hash()).toEqual(utxo.hash())

      // check outflow
      // 0: (eth + erc20) utxo for Bob, 2: eth utxo for Alice and 1: erc20 utxo for Alice
      expect(rawTx.outflow.length).toEqual(3)
      expect(rawTx.outflow[0].asset.eth.toString()).toEqual(
        parseEther('0.5').toString(),
      )
      expect(rawTx.outflow[0].asset.erc20Amount.toString()).toEqual('0')
      expect(rawTx.outflow[0].owner).toEqual(bob.zkAddress)

      expect(rawTx.fee.toString()).toEqual(parseUnits('503', 'gwei').toString())
      expect(rawTx.outflow[1].asset.eth.toString()).toEqual(
        parseEther('0.5')
          .sub(parseUnits('503', 'gwei'))
          .toString(),
      )
      expect(rawTx.outflow[1].asset.erc20Amount.toString()).toEqual('0')
      expect(rawTx.outflow[1].owner).toEqual(alice.zkAddress)
      expect(rawTx.outflow[2].asset.eth.toString()).toEqual('0')
      expect(rawTx.outflow[2].asset.erc20Amount.toString()).toEqual(
        parseEther('100').toString(),
      )

      expect(rawTx.outflow[2].owner).toEqual(alice.zkAddress)
    })

    it('IN: 1 (ETH + ERC20) utxo and 1 ETH utxo, SPENT: ETH and the utxo includes ETH only', async () => {
      const utxo = generateUtxo('1', '100')
      const utxoETH = generateUtxo('2', '0')
      const rawTx = txBuilder
        .provide(utxo)
        .provide(utxoETH)
        .sendEther({
          eth: Fp.from(parseEther('1.5')),
          to: bob.zkAddress,
        })
        .build()

      // check inflow
      expect(rawTx.inflow.length).toEqual(1)
      expect(rawTx.inflow[0].hash()).toEqual(utxoETH.hash())

      // check outflow
      expect(rawTx.outflow.length).toEqual(2)
      expect(rawTx.outflow[0].asset.eth.toString()).toEqual(
        parseEther('1.5').toString(),
      )
      expect(rawTx.outflow[0].asset.erc20Amount.toString()).toEqual('0')
      expect(rawTx.outflow[0].owner).toEqual(bob.zkAddress)

      expect(rawTx.fee.toString()).toEqual(parseUnits('470', 'gwei').toString())
      expect(rawTx.outflow[1].asset.eth.toString()).toEqual(
        parseEther('0.5')
          .sub(parseUnits('470', 'gwei'))
          .toString(),
      )
      expect(rawTx.outflow[1].asset.erc20Amount.toString()).toEqual('0')
      expect(rawTx.outflow[1].owner).toEqual(alice.zkAddress)
    })

    it('IN: 1 (ETH + ERC20) utxo and 1 ETH utxo, SPENT: ERC20', async () => {
      const utxo = generateUtxo('1', '100')
      const utxoETH = generateUtxo('2', '0')
      const rawTx = txBuilder
        .provide(utxo)
        .provide(utxoETH)
        .sendERC20({
          tokenAddr: ERC20_ADDR,
          erc20Amount: Fp.from(parseEther('50')),
          to: bob.zkAddress,
        })
        .build()

      // check inflow
      expect(rawTx.inflow.length).toEqual(1)
      expect(rawTx.inflow[0].hash()).toEqual(utxo.hash())

      // check outflow
      expect(rawTx.outflow.length).toEqual(3)
      expect(rawTx.outflow[0].asset.erc20Amount.toString()).toEqual(
        parseEther('50').toString(),
      )
      expect(rawTx.outflow[0].asset.eth.toString()).toEqual('0')
      expect(rawTx.outflow[0].owner).toEqual(bob.zkAddress)

      expect(rawTx.fee.toString()).toEqual(parseUnits('503', 'gwei').toString())
      expect(rawTx.outflow[1].asset.eth.toString()).toEqual(
        parseEther('1')
          .sub(parseUnits('503', 'gwei'))
          .toString(),
      )
      expect(rawTx.outflow[1].asset.erc20Amount.toString()).toEqual('0')
      expect(rawTx.outflow[1].owner).toEqual(alice.zkAddress)
      expect(rawTx.outflow[2].asset.eth.toString()).toEqual('0')
      expect(rawTx.outflow[2].asset.erc20Amount.toString()).toEqual(
        parseEther('50').toString(),
      )
      expect(rawTx.outflow[2].owner).toEqual(alice.zkAddress)
    })
  })

  describe('combined asset utxo in, combined asset utxo out', () => {
    it('IN: 1 (ETH + ERC20) utxo and 1 ERC20 utxo, SPENT: (ETH + ERC20) and only one utxo was used', async () => {
      const utxo = generateUtxo('1', '100')
      const utxoERC20 = generateUtxo('0', '200')
      const rawTx = txBuilder
        .provide(utxo)
        .provide(utxoERC20)
        .sendERC20({
          tokenAddr: ERC20_ADDR,
          erc20Amount: Fp.from(parseEther('50')),
          to: bob.zkAddress,
        })
        .sendEther({
          eth: Fp.from(parseEther('0.5')),
          to: bob.zkAddress,
        })
        .build()

      // check inflow
      expect(rawTx.inflow.length).toEqual(1)
      expect(rawTx.inflow[0].hash()).toEqual(utxo.hash())

      // check outflow
      // 0: (eth + erc20) utxo for Bob, 2: eth utxo for Alice and 1: erc20 utxo for Alice
      expect(rawTx.outflow.length).toEqual(4)
      expect(rawTx.outflow[0].asset.erc20Amount.toString()).toEqual(
        parseEther('50').toString(),
      )
      expect(rawTx.outflow[1].asset.eth.toString()).toEqual(
        parseEther('0.5').toString(),
      )
      expect(rawTx.outflow[0].owner).toEqual(bob.zkAddress)

      expect(rawTx.fee.toString()).toEqual(parseUnits('536', 'gwei').toString())
      expect(rawTx.outflow[2].asset.eth.toString()).toEqual(
        parseEther('0.5')
          .sub(parseUnits('536', 'gwei'))
          .toString(),
      )
      expect(rawTx.outflow[2].asset.erc20Amount.toString()).toEqual('0')
      expect(rawTx.outflow[2].owner).toEqual(alice.zkAddress)
      expect(rawTx.outflow[3].asset.eth.toString()).toEqual('0')
      expect(rawTx.outflow[3].asset.erc20Amount.toString()).toEqual(
        parseEther('50').toString(),
      )
      expect(rawTx.outflow[3].owner).toEqual(alice.zkAddress)
    })

    it('IN: 1 (ETH + ERC20) utxo and 1 ETH utxo, SPENT: (ETH + ERC20) and only one utxo was used', async () => {
      const utxo = generateUtxo('1', '100')
      const utxoETH = generateUtxo('2', '0')
      const rawTx = txBuilder
        .provide(utxo)
        .provide(utxoETH)
        .sendERC20({
          tokenAddr: ERC20_ADDR,
          erc20Amount: Fp.from(parseEther('50')),
          to: bob.zkAddress,
        })
        .sendEther({
          eth: Fp.from(parseEther('0.5')),
          to: bob.zkAddress,
        })
        .build()

      // check inflow
      expect(rawTx.inflow.length).toEqual(1)
      expect(rawTx.inflow[0].hash()).toEqual(utxo.hash())

      // check outflow
      // 0: (eth + erc20) utxo for Bob, 2: eth utxo for Alice and 1: erc20 utxo for Alice
      expect(rawTx.outflow.length).toEqual(4)
      expect(rawTx.outflow[0].asset.erc20Amount.toString()).toEqual(
        parseEther('50').toString(),
      )
      expect(rawTx.outflow[1].asset.eth.toString()).toEqual(
        parseEther('0.5').toString(),
      )
      expect(rawTx.outflow[0].owner).toEqual(bob.zkAddress)
      expect(rawTx.outflow[1].owner).toEqual(bob.zkAddress)

      expect(rawTx.fee.toString()).toEqual(parseUnits('536', 'gwei').toString())
      expect(rawTx.outflow[2].asset.eth.toString()).toEqual(
        parseEther('0.5')
          .sub(parseUnits('536', 'gwei'))
          .toString(),
      )
      expect(rawTx.outflow[2].asset.erc20Amount.toString()).toEqual('0')
      expect(rawTx.outflow[2].owner).toEqual(alice.zkAddress)
      expect(rawTx.outflow[3].asset.eth.toString()).toEqual('0')
      expect(rawTx.outflow[3].asset.erc20Amount.toString()).toEqual(
        parseEther('50').toString(),
      )
      expect(rawTx.outflow[3].owner).toEqual(alice.zkAddress)
    })

    it('IN: 1 (ETH + ERC20) utxo and 1 ETH utxo, SPENT: (ETH + ERC20) and both of utxos were used', async () => {
      const utxo = generateUtxo('1', '100')
      const utxoETH = generateUtxo('2', '0')
      const rawTx = txBuilder
        .provide(utxo)
        .provide(utxoETH)
        .sendERC20({
          tokenAddr: ERC20_ADDR,
          erc20Amount: Fp.from(parseEther('50')),
          to: bob.zkAddress,
        })
        .sendEther({
          eth: Fp.from(parseEther('1.5')),
          to: bob.zkAddress,
        })
        .build()

      // check inflow
      expect(rawTx.inflow.length).toEqual(2)

      // check outflow
      // 0: (eth + erc20) utxo for Bob, 2: eth utxo for Alice and 1: erc20 utxo for Alice
      expect(rawTx.outflow.length).toEqual(4)
      expect(rawTx.outflow[0].asset.erc20Amount.toString()).toEqual(
        parseEther('50').toString(),
      )
      expect(rawTx.outflow[1].asset.eth.toString()).toEqual(
        parseEther('1.5').toString(),
      )
      expect(rawTx.outflow[0].owner).toEqual(bob.zkAddress)
      expect(rawTx.outflow[1].owner).toEqual(bob.zkAddress)

      expect(rawTx.fee.toString()).toEqual(parseUnits('600', 'gwei').toString())
      expect(rawTx.outflow[2].asset.eth.toString()).toEqual(
        parseEther('1.5')
          .sub(parseUnits('600', 'gwei'))
          .toString(),
      )
      expect(rawTx.outflow[2].asset.erc20Amount.toString()).toEqual('0')
      expect(rawTx.outflow[2].owner).toEqual(alice.zkAddress)
      expect(rawTx.outflow[3].asset.eth.toString()).toEqual('0')
      expect(rawTx.outflow[3].asset.erc20Amount.toString()).toEqual(
        parseEther('50').toString(),
      )
      expect(rawTx.outflow[3].owner).toEqual(alice.zkAddress)
    })

    it('IN: 1 (ETH + ERC20) utxo and 1 ETH utxo, SPENT: (ETH + ERC20) and both of utxos were used', async () => {
      const utxo = generateUtxo('1', '100')
      const utxo2 = generateUtxo('10', '200')
      const utxoETH5 = generateUtxo('5', '0')
      const rawTx = txBuilder
        .provide(utxo)
        .provide(utxo2)
        .provide(utxoETH5)
        .sendERC20({
          tokenAddr: ERC20_ADDR,
          erc20Amount: Fp.from(parseEther('50')),
          to: bob.zkAddress,
        })
        .sendEther({
          eth: Fp.from(parseEther('2')),
          to: bob.zkAddress,
        })
        .build()

      // check inflow
      expect(rawTx.inflow.length).toEqual(2)
      expect(rawTx.inflow[0].hash()).toEqual(utxo.hash())
      expect(rawTx.inflow[1].hash()).toEqual(utxoETH5.hash())

      // check outflow
      expect(rawTx.outflow.length).toEqual(4)
      expect(rawTx.outflow[0].asset.erc20Amount.toString()).toEqual(
        parseEther('50').toString(),
      )
      expect(rawTx.outflow[1].asset.eth.toString()).toEqual(
        parseEther('2').toString(),
      )
      expect(rawTx.outflow[0].owner).toEqual(bob.zkAddress)
      expect(rawTx.outflow[1].owner).toEqual(bob.zkAddress)

      expect(rawTx.fee.toString()).toEqual(parseUnits('600', 'gwei').toString())
      expect(rawTx.outflow[2].asset.eth.toString()).toEqual(
        parseEther('4')
          .sub(parseUnits('600', 'gwei'))
          .toString(),
      )
      expect(rawTx.outflow[2].asset.erc20Amount.toString()).toEqual('0')
      expect(rawTx.outflow[2].owner).toEqual(alice.zkAddress)
      expect(rawTx.outflow[3].asset.eth.toString()).toEqual('0')
      expect(rawTx.outflow[3].asset.erc20Amount.toString()).toEqual(
        parseEther('50').toString(),
      )
      expect(rawTx.outflow[3].owner).toEqual(alice.zkAddress)
    })
    it('IN: 1 (ETH + ERC20) utxo, 1 ETH utxo and 1 ERC20 utxo, SPENT: (ETH + ERC20) and all the utxos were used', async () => {
      const utxo = generateUtxo('1', '100')
      const utxoETH = generateUtxo('2', '0')
      const utxoERC20 = generateUtxo('0', '200')
      const rawTx = txBuilder
        .provide(utxo)
        .provide(utxoETH)
        .provide(utxoERC20)
        .sendERC20({
          tokenAddr: ERC20_ADDR,
          erc20Amount: Fp.from(parseEther('250')),
          to: bob.zkAddress,
        })
        .sendEther({
          eth: Fp.from(parseEther('2.5')),
          to: bob.zkAddress,
        })
        .build()

      // check inflow
      expect(rawTx.inflow.length).toEqual(3)

      // check outflow
      // 0: (eth + erc20) utxo for Bob, 2: eth utxo for Alice and 1: erc20 utxo for Alice
      expect(rawTx.outflow.length).toEqual(4)
      expect(rawTx.outflow[0].asset.erc20Amount.toString()).toEqual(
        parseEther('250').toString(),
      )
      expect(rawTx.outflow[1].asset.eth.toString()).toEqual(
        parseEther('2.5').toString(),
      )
      expect(rawTx.outflow[0].owner).toEqual(bob.zkAddress)
      expect(rawTx.outflow[1].owner).toEqual(bob.zkAddress)

      expect(rawTx.fee.toString()).toEqual(parseUnits('664', 'gwei').toString())
      expect(rawTx.outflow[2].asset.eth.toString()).toEqual(
        parseEther('0.5')
          .sub(parseUnits('664', 'gwei'))
          .toString(),
      )
      expect(rawTx.outflow[2].asset.erc20Amount.toString()).toEqual('0')
      expect(rawTx.outflow[2].owner).toEqual(alice.zkAddress)
      expect(rawTx.outflow[3].asset.eth.toString()).toEqual('0')
      expect(rawTx.outflow[3].asset.erc20Amount.toString()).toEqual(
        parseEther('50').toString(),
      )
      expect(rawTx.outflow[3].owner).toEqual(alice.zkAddress)
    })
  })
})
