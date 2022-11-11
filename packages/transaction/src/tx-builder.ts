import { Fp } from '@zkopru/babyjubjub'
import { txSizeCalculator, logger } from '@zkopru/utils'
import assert from 'assert'
import { BigNumberish } from 'ethers'
import { formatUnits } from 'ethers/lib/utils'
import { Address } from 'soltypes'
import { ZkAddress } from './zk-address'
import { Utxo } from './utxo'
import { Sum } from './note-sum'
import { Outflow } from './outflow'
import { Withdrawal } from './withdrawal'
import { Migration } from './migration'
import { OutflowType } from './note'
import { RawTx } from './raw-tx'

export class TxBuilder {
  spendables: Utxo[]

  sendings: Outflow[]

  feePerByte: Fp

  swap?: Fp

  changeTo: ZkAddress

  constructor(owner: ZkAddress) {
    this.spendables = []
    this.sendings = []
    this.changeTo = owner
    this.feePerByte = Fp.zero
  }

  static from(owner: ZkAddress): TxBuilder {
    return new TxBuilder(owner)
  }

  weiPerByte(val: BigNumberish): TxBuilder {
    this.feePerByte = Fp.from(val)
    return this
  }

  provide(...utxos: Utxo[]): TxBuilder {
    utxos.forEach(utxo => this.spendables.push(utxo))
    return this
  }

  /**
   * This will throw underflow Error when it does not have enough ETH for fee
   */
  spendable(): Sum {
    const asset = Sum.from(this.spendables)
    // asset.eth = asset.eth.sub(this.weiPerByte)
    return asset
  }

  sendEther({
    eth,
    to,
    withdrawal,
    migration,
  }: {
    eth: BigNumberish
    to: ZkAddress
    withdrawal?: {
      to: BigNumberish
      fee: BigNumberish
    }
    migration?: {
      to: BigNumberish
      fee: BigNumberish
    }
  }): TxBuilder {
    if (withdrawal && migration)
      throw Error(
        'You should have only one value of withdrawalTo or migrationTo',
      )
    const note = Utxo.newEtherNote({ eth, owner: to })
    this.send(note, withdrawal, migration)
    return this
  }

  sendERC20({
    tokenAddr,
    erc20Amount,
    to,
    eth,
    withdrawal,
    migration,
  }: {
    tokenAddr: BigNumberish
    erc20Amount: BigNumberish
    to: ZkAddress
    eth?: BigNumberish
    withdrawal?: {
      to: BigNumberish
      fee: BigNumberish
    }
    migration?: {
      to: BigNumberish
      fee: BigNumberish
    }
  }): TxBuilder {
    const note = Utxo.newERC20Note({
      eth: eth || 0,
      tokenAddr,
      erc20Amount,
      owner: to,
    })
    this.send(note, withdrawal, migration)
    return this
  }

  sendNFT({
    tokenAddr,
    nft,
    to,
    eth,
    withdrawal,
    migration,
  }: {
    tokenAddr: BigNumberish
    nft: BigNumberish
    to: ZkAddress
    eth?: BigNumberish
    withdrawal?: {
      to: BigNumberish
      fee: BigNumberish
    }
    migration?: {
      to: BigNumberish
      fee: BigNumberish
    }
  }): TxBuilder {
    const note = Utxo.newNFTNote({
      eth: eth || 0,
      tokenAddr,
      nft,
      owner: to,
    })
    this.send(note, withdrawal, migration)
    return this
  }

  protected collectERC20Notes(sendingAmount: Sum): Utxo[] {
    const spendings: Utxo[] = []
    Object.keys(sendingAmount.erc20).forEach(addr => {
      const targetAmount: Fp = sendingAmount.getERC20(addr)
      const sameERC20UTXOs: Utxo[] = this.spendables
        .filter(utxo =>
          utxo
            .tokenAddr()
            .toAddress()
            .eq(Address.from(addr)),
        )
        .sort((a, b) => (a.erc20Amount().gt(b.erc20Amount()) ? 1 : -1))
      let spendingOfSameERC20: Utxo[] = []
      for (const utxo of sameERC20UTXOs) {
        if (utxo.asset.erc20Amount.gte(targetAmount)) {
          spendingOfSameERC20 = [utxo]
          break
        } else if (targetAmount.gt(Sum.from(spendings).getERC20(addr))) {
          spendingOfSameERC20.push(utxo)
          // spendingOfSameERC20.push(
          //   ...this.spendables.splice(this.spendables.indexOf(utxo), 1),
          // )
        } else {
          break
        }
      }
      spendings.push(...spendingOfSameERC20)
      if (targetAmount.gt(Sum.from(spendings).getERC20(addr))) {
        throw Error(`Not enough ERC20 token ${addr} / ${targetAmount}`)
      }
    })
    return spendings
  }

  protected collectERC721Notes(sendingAmount: Sum): Utxo[] {
    const spendings: Utxo[] = []
    Object.keys(sendingAmount.erc721).forEach(addr => {
      const sendingNFTs: Fp[] = sendingAmount
        .getNFTs(addr)
        .sort((a, b) => (a.gt(b) ? 1 : -1))
      const spendingNFTNotes: Utxo[] = this.spendables.filter(utxo => {
        return (
          utxo
            .tokenAddr()
            .toAddress()
            .eq(Address.from(addr)) &&
          sendingNFTs.find(nft => nft.eq(utxo.nft())) !== undefined
        )
      })
      if (sendingNFTs.length !== spendingNFTNotes.length) {
        throw Error('Not enough NFTs')
      }
      spendingNFTNotes.sort((a, b) => (a.nft().gt(b.nft()) ? 1 : -1))
      for (let i = 0; i < sendingNFTs.length; i += 1) {
        if (!sendingNFTs[i].eq(spendingNFTNotes[i].nft()))
          throw Error('Failed to find the exact NFT')
      }
      for (const utxo of spendingNFTNotes) {
        // spendings.push(
        //   ...this.spendables.splice(this.spendables.indexOf(utxo), 1),
        // )
        spendings.push(utxo)
      }
    })
    return spendings
  }

  protected calculateERC20Changes(
    spendingAmount: Sum,
    sendingAmount: Sum,
  ): Utxo[] {
    const changes: Utxo[] = []
    Object.keys(spendingAmount.erc20).forEach(addr => {
      const change = spendingAmount
        .getERC20(addr)
        .sub(sendingAmount.getERC20(addr))
      if (!change.isZero()) {
        changes.push(
          Utxo.newERC20Note({
            eth: 0,
            tokenAddr: Fp.from(addr),
            erc20Amount: change,
            owner: this.changeTo,
          }),
        )
      }
    })
    return changes
  }

  protected calculateERC721Changes(
    spendingAmount: Sum,
    sendingAmount: Sum,
  ): Utxo[] {
    const changes: Utxo[] = []
    const extraNFTs: { [addr: string]: Fp[] } = {}
    Object.keys(spendingAmount.erc721).forEach(addr => {
      extraNFTs[addr] = spendingAmount.getNFTs(addr).filter(nft => {
        if (sendingAmount.getNFTs(addr).length === 0) {
          return true
        }
        if (sendingAmount.getNFTs(addr).find(f => f.eq(nft)) === undefined) {
          return true
        }
        return false
      })
    })
    Object.keys(extraNFTs).forEach(addr => {
      extraNFTs[addr].forEach(nft => {
        changes.push(
          Utxo.newNFTNote({
            eth: 0,
            tokenAddr: Fp.from(addr),
            nft,
            owner: this.changeTo,
          }),
        )
      })
    })
    return changes
  }

  protected getTxFee(spendings: Utxo[], changes: Utxo[]): Fp {
    const size = txSizeCalculator(
      spendings.length,
      this.sendings.length + changes.length, // 1 is for Ether change note
      this.sendings.filter(note => note.outflowType !== OutflowType.UTXO)
        .length,
      !!this.swap,
      false,
    )
    return this.feePerByte.mul(size)
  }

  protected getRequiredETH(
    sendingEthAmount: Fp,
    spendings: Utxo[],
    changes: Utxo[],
    l1Fee: Fp,
  ): Fp {
    return sendingEthAmount.add(this.getTxFee(spendings, changes)).add(l1Fee)
  }

  protected mergeERC20Changes(spending: Utxo, finalChanges: Utxo[]): Utxo[] {
    let isNewERC20Utxo = true
    finalChanges.forEach(change => {
      if (change.asset.tokenAddr.eq(spending.asset.tokenAddr)) {
        finalChanges.splice(
          finalChanges.indexOf(change),
          1,
          Utxo.newERC20Note({
            eth: '0',
            tokenAddr: spending.asset.tokenAddr,
            erc20Amount: change.asset.erc20Amount.add(
              spending.asset.erc20Amount,
            ),
            owner: spending.owner,
          }),
        )
        isNewERC20Utxo = false
      }
    })
    if (isNewERC20Utxo) {
      finalChanges.push(
        Utxo.newERC20Note({
          eth: '0',
          tokenAddr: spending.asset.tokenAddr,
          erc20Amount: spending.asset.erc20Amount,
          owner: spending.owner,
        }),
      )
    }

    return finalChanges
  }

  protected collectETHNotesAndChanges(
    sendingAmount: Fp,
    spendables: Utxo[],
    spendings: Utxo[],
    changes: Utxo[],
    l1Fee: Fp,
  ): {
    finalSpendings: Utxo[]
    finalChanges: Utxo[]
  } {
    let finalSpendings: Utxo[] = []
    let finalChanges: Utxo[] = []
    let ethChanges: Utxo
    let requiredETH: Fp

    // merge changes by asset type
    const initEthChanges = Utxo.newEtherNote({
      eth: Sum.from(changes).eth,
      owner: this.changeTo,
    })
    finalChanges.push(initEthChanges)
    ethChanges = initEthChanges

    Object.keys(Sum.from(changes).erc20).forEach(addr => {
      const change = Sum.from(changes).getERC20(addr)
      if (!change.isZero()) {
        finalChanges.push(
          Utxo.newERC20Note({
            eth: 0,
            tokenAddr: Fp.from(addr),
            erc20Amount: change,
            owner: this.changeTo,
          }),
        )
      }
    })
    Object.keys(Sum.from(changes).erc721).forEach(addr => {
      Sum.from(changes)[addr].forEach(nft => {
        finalChanges.push(
          Utxo.newNFTNote({
            eth: 0,
            tokenAddr: Fp.from(addr),
            nft,
            owner: this.changeTo,
          }),
        )
      })
    })
    finalSpendings.push(...spendings)
    changes = [...finalChanges]

    requiredETH = this.getRequiredETH(
      sendingAmount,
      spendings,
      finalChanges,
      l1Fee,
    )

    let index = 0
    do {
      logger.info(
        `transaction/tx-builder.ts - required eth: ${requiredETH.toString()}`,
      )
      logger.info(
        `transaction/tx-builder.ts - spending eth: ${
          Sum.from(finalSpendings).eth
        }`,
      )

      // fetch spending from spendings or spendables
      let spending
      if (spendings.length > index) {
        spending = spendings[index]
        // remove the same item from spendables for efficiency
        spendables.splice(spendables.indexOf(spending), 1)
      } else {
        spending = spendables[index - spendings.length]
      }
      index++

      if (spending === undefined) {
        const owned = Sum.from(spendables).eth
        const target = this.getRequiredETH(
          sendingAmount,
          finalSpendings,
          changes,
          l1Fee,
        )
        const insufficient = target.sub(owned)
        throw Error(
          `Not enough Ether. Insufficient: ${formatUnits(
            insufficient.toString(),
            'ether',
          )}`,
        )
      }

      const isFromInputSpendings = spendings.includes(spending)
      if (spending.eth().eq(0)) continue
      // if any one of spending is enough to afford the requirement, using the spending directly.
      if (spending.eth().gte(requiredETH)) {
        if (!isFromInputSpendings) {
          finalSpendings = spendings.concat(spending)
        }
        finalChanges = [...changes]
      } else {
        if (!isFromInputSpendings) finalSpendings.push(spending)
      }

      logger.info(
        `transaction/tx-builder.ts - spending finalSpendings: [${spending
          .hash()
          .toBytes32()
          .toString()}]`,
      )

      if (!isFromInputSpendings) {
        if (spending.asset.erc20Amount.gt('0')) {
          finalChanges = this.mergeERC20Changes(spending, finalChanges)
        }
        if (spending.asset.nft.gt('0')) {
          finalChanges.push(
            Utxo.newNFTNote({
              eth: '0',
              tokenAddr: spending.asset.tokenAddr,
              nft: spending.asset.nft,
              owner: spending.owner,
            }),
          )
        }
      }

      requiredETH = this.getRequiredETH(
        sendingAmount,
        finalSpendings,
        finalChanges,
        l1Fee,
      )
      const currentEthChangesIdx = finalChanges.indexOf(ethChanges)
      ethChanges = Utxo.newEtherNote({
        eth: Sum.from(finalSpendings).eth.sub(requiredETH),
        owner: this.changeTo,
      })
      finalChanges.splice(
        currentEthChangesIdx >= 0
          ? currentEthChangesIdx
          : finalChanges.indexOf(initEthChanges),
        1,
        ethChanges,
      )
    } while (requiredETH.gte(Sum.from(finalSpendings).eth))

    return {
      finalSpendings,
      finalChanges,
    }
  }

  build(): RawTx & { withdrawals: Withdrawal[] } {
    const spendables: Utxo[] = [...this.spendables]
    const spendings: Utxo[] = []
    const sendingAmount = Sum.from(this.sendings)
    const outgoingNotes: (Withdrawal | Migration)[] = this.sendings.filter(
      sending => sending instanceof Withdrawal || sending instanceof Migration,
    ) as (Withdrawal | Migration)[]
    const l1Fee = outgoingNotes.reduce(
      (acc, note) => acc.add(note.publicData.fee),
      Fp.zero,
    )

    // collect ERC20 and ERC721 notes for spendings
    spendings.push(...this.collectERC20Notes(sendingAmount))
    const spendingsOfERC20NERC721 = spendings.concat(
      this.collectERC721Notes(sendingAmount).filter(
        item => spendings.indexOf(item) < 0,
      ),
    )

    // collect ERC20 and ERC721 changes
    const changes: Utxo[] = []
    changes.push(
      ...this.calculateERC20Changes(
        Sum.from(spendingsOfERC20NERC721),
        sendingAmount,
      ),
    )
    changes.push(
      ...this.calculateERC721Changes(
        Sum.from(spendingsOfERC20NERC721),
        sendingAmount,
      ),
    )

    const { finalSpendings, finalChanges } = this.collectETHNotesAndChanges(
      Sum.from(this.sendings).eth,
      spendables.sort((a, b) => (a.eth().gt(b.eth()) ? 1 : -1)),
      spendings,
      changes,
      l1Fee,
    )

    const inflow = [...finalSpendings]
    const outflow = [...this.sendings, ...finalChanges]
    const inflowSum = Sum.from(inflow)
    const outflowSum = Sum.from(outflow)
    const finalFee = this.getTxFee(inflow, finalChanges)

    assert(
      inflowSum.eth.eq(outflowSum.eth.add(finalFee).add(l1Fee)),
      'inflow != outflow',
    )
    for (const addr of Object.keys(inflowSum.erc20)) {
      if (outflowSum.getERC20(addr).eq('0')) continue
      assert(
        inflowSum.getERC20(addr).eq(outflowSum.getERC20(addr)),
        'erc20 in-out is different',
      )
    }
    for (const addr of Object.keys(inflowSum.erc721)) {
      if (outflowSum.getNFTs.length == 0) continue
      const inflowNFTs = JSON.stringify(
        inflowSum.getNFTs(addr).map(f => f.toString()),
      )
      const outflowNFTs = JSON.stringify(
        outflowSum.getNFTs(addr).map(f => f.toString()),
      )
      assert(inflowNFTs === outflowNFTs, 'nft in-out is different')
    }
    return {
      inflow,
      outflow,
      swap: this.swap,
      fee: finalFee,
      withdrawals: this.sendings.filter(
        sending => sending instanceof Withdrawal,
      ) as Withdrawal[],
    }
  }

  protected send(
    note: Outflow,
    withdrawal?: {
      to: BigNumberish
      fee: BigNumberish
    },
    migration?: {
      to: BigNumberish
      fee: BigNumberish
    },
  ) {
    if (withdrawal) {
      this.sendings.push(Withdrawal.from(note, withdrawal.to, withdrawal.fee))
    } else if (migration) {
      this.sendings.push(Migration.from(note, migration.to, migration.fee))
    } else {
      this.sendings.push(note)
    }
  }
}
