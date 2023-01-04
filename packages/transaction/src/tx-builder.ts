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
  MAX_INFLOW_NUM = 4
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

  protected collectERC20Notes(sendingAmount: Sum, spendables: Utxo[]): Utxo[] {
    const spendings: Utxo[] = []
    Object.keys(sendingAmount.erc20).forEach(addr => {
      const targetAmount: Fp = sendingAmount.getERC20(addr)
      const sameERC20UTXOs: Utxo[] = spendables
        .filter(utxo =>
          utxo
            .tokenAddr()
            .toAddress()
            .eq(Address.from(addr)),
        )
        .sort((a, b) => (a.erc20Amount().gt(b.erc20Amount()) ? 1 : -1))
      let spendingOfSameERC20: Utxo[] = []
      for (const utxo of sameERC20UTXOs) {
        if (utxo.asset.erc20Amount.isZero()) continue
        if (utxo.asset.erc20Amount.gte(targetAmount)) {
          spendingOfSameERC20 = [utxo]
          break
        } else if (
          targetAmount.gt(Sum.from(spendingOfSameERC20).getERC20(addr))
        ) {
          spendingOfSameERC20.push(utxo)
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

  protected collectERC721Notes(sendingAmount: Sum, spendables: Utxo[]): Utxo[] {
    const spendings: Utxo[] = []
    Object.keys(sendingAmount.erc721).forEach(addr => {
      const sendingNFTs: Fp[] = sendingAmount
        .getNFTs(addr)
        .sort((a, b) => (a.gt(b) ? 1 : -1))
      const spendingNFTNotes: Utxo[] = spendables.filter(utxo => {
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

  protected getTxFee(spendingsLen: number, changesLen: number): Fp {
    const size = txSizeCalculator(
      spendingsLen,
      this.sendings.length + changesLen,
      this.sendings.filter(note => note.outflowType !== OutflowType.UTXO)
        .length,
      !!this.swap,
      false,
    )
    return this.feePerByte.mul(size)
  }

  protected getNotesCountForFeeCalc(spendings: Utxo[]): number {
    let hasERC20Notes: boolean = false
    let hasERC721otes: boolean = false
    let hasETHNotes: boolean = false
    // always have one for eth
    let noteCount = 0
    spendings.forEach(spending => {
      if (spending.asset.erc20Amount.gt(0)) hasERC20Notes = true
      if (spending.asset.nft.gt(0)) hasERC721otes = true
      if (spending.asset.eth.gt(0)) hasETHNotes = true
    })
    if (hasERC20Notes) noteCount++
    if (hasERC721otes) noteCount++
    if (hasETHNotes) noteCount++
    return noteCount
  }

  protected getRequiredETH(
    sendingEthAmount: Fp,
    spendingsLen: number,
    changesLen: number,
    l1Fee: Fp,
  ): Fp {
    return sendingEthAmount
      .add(this.getTxFee(spendingsLen, changesLen))
      .add(l1Fee)
  }

  protected mergeUtxos(a: Utxo[], b: Utxo[]): Utxo[] {
    return a.concat(b.filter(item => a.indexOf(item) < 0))
  }

  protected collectETHNotesAndChanges(
    sendingAmount: Fp,
    spendables: Utxo[],
    spendings: Utxo[],
    changes: Utxo[],
    l1Fee: Fp,
  ): {
    ethSpendings: Utxo[]
    ethChange?: Utxo
  } {
    let ethSpendings: Utxo[] = []
    let requiredETH: Fp

    requiredETH = this.getRequiredETH(
      sendingAmount,
      spendings.length,
      this.getNotesCountForFeeCalc(changes),
      l1Fee,
    )

    let index = 0
    let finalSpendings: Utxo[] = []
    do {
      // fetch spending from spendings or spendables
      let spending
      if (spendings.length > index) {
        spending = spendings[index]
        // remove the same item from spendables for efficiency
        spendables.splice(spendables.indexOf(spending), 1)
      } else {
        spending = spendables.pop()
      }
      index++

      if (spending === undefined) {
        // special case: if a user is trying to spend all ETH, the ETH change should be 0
        const requiredETHWithoutETHChanges = this.getRequiredETH(
          sendingAmount,
          finalSpendings.length,
          this.getNotesCountForFeeCalc(changes.concat(ethSpendings)) - 1,
          l1Fee,
        )
        if (Sum.from(finalSpendings).eth.gte(requiredETHWithoutETHChanges)) {
          return {
            ethSpendings,
          }
        }

        const owned = Sum.from(this.spendables).eth
        const insufficient = requiredETH.sub(owned)
        if (requiredETH)
          throw Error(
            `Not enough Ether. Insufficient: ${formatUnits(
              insufficient.toString(),
              'ether',
            )}`,
          )
      }

      if (spending.eth().eq(0)) continue
      // if any one of spending is enough to afford the requirement, using the spending directly.
      if (spending.eth().gte(requiredETH)) {
        ethSpendings = [spending]
      } else {
        // if total utxo exceed the limit, remove the utxo with least eth amount
        if (
          this.mergeUtxos(spendings, ethSpendings).length >= this.MAX_INFLOW_NUM
        ) {
          for (let i = 0; i < ethSpendings.length; i++) {
            // if the spending is one of input spendings, skip it
            if (spendings.includes(ethSpendings[i])) continue
            ethSpendings.splice(ethSpendings.indexOf(ethSpendings[i]), 1)
            break
          }
        }
        ethSpendings.push(spending)
      }

      logger.info(
        `transaction/tx-builder.ts - required eth: ${requiredETH.toString()}`,
      )
      logger.info(
        `transaction/tx-builder.ts - spending eth: ${
          Sum.from(ethSpendings).eth
        }`,
      )
      logger.info(
        `transaction/tx-builder.ts - spending ethSpendings: [${spending
          .hash()
          .toBytes32()
          .toString()}]`,
      )

      finalSpendings = this.mergeUtxos(spendings, ethSpendings)
      requiredETH = this.getRequiredETH(
        sendingAmount,
        finalSpendings.length,
        this.getNotesCountForFeeCalc(changes.concat(ethSpendings)),
        l1Fee,
      )
    } while (requiredETH.gt(Sum.from(finalSpendings).eth))

    return {
      ethSpendings,
      ethChange: Utxo.newEtherNote({
        eth: Sum.from(finalSpendings).eth.sub(requiredETH),
        owner: this.changeTo,
      }),
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
    spendings.push(...this.collectERC20Notes(sendingAmount, spendables))
    const spendingsOfERC20NERC721 = this.mergeUtxos(
      spendings,
      this.collectERC721Notes(sendingAmount, spendables),
    )
    if (spendingsOfERC20NERC721.length > this.MAX_INFLOW_NUM) {
      throw Error(
        `Number of ERC20 and ERC721 spendings exceed the max number of inflow, had ${spendingsOfERC20NERC721.length}`,
      )
    }

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

    const { ethSpendings, ethChange } = this.collectETHNotesAndChanges(
      Sum.from(this.sendings).eth,
      spendables.sort((a, b) => (a.eth().gt(b.eth()) ? -1 : 1)),
      spendingsOfERC20NERC721,
      changes,
      l1Fee,
    )

    // merge spendings and changes
    const finalChanges: Utxo[] = []
    const finalSpendings = this.mergeUtxos(
      spendingsOfERC20NERC721,
      ethSpendings,
    )
    if (finalSpendings.length > this.MAX_INFLOW_NUM) {
      throw Error(`Exceed max number of inflow, had ${ethSpendings.length}`)
    }

    if (ethChange !== undefined) {
      finalChanges.push(ethChange)
    }
    // ethSpendings could include ERC20 or ERC721 notes, recalculate ERC20 and ERC721 notes here
    finalChanges.push(
      ...this.calculateERC20Changes(Sum.from(finalSpendings), sendingAmount),
    )
    finalChanges.push(
      ...this.calculateERC721Changes(Sum.from(finalSpendings), sendingAmount),
    )

    const inflow = [...finalSpendings]
    const outflow = [...this.sendings, ...finalChanges]
    const inflowSum = Sum.from(inflow)
    const outflowSum = Sum.from(outflow)
    const finalFee = this.getTxFee(inflow.length, finalChanges.length)

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
