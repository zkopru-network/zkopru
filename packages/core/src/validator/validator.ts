import assert from 'assert'
import { Field } from '@zkopru/babyjubjub'
import { Bytes32, Uint256 } from 'soltypes'
import { logger } from '@zkopru/utils'
import BN from 'bn.js'
import { L1Contract } from '~core/context/layer1'
import { Block, Header, headerHash } from '../block'
import { L2Chain } from '../context/layer2'
import { OffchainValidator } from './offchain'
import { OnchainValidator } from './onchain'
import { ChallengeTx, FnCall, ValidateFnCalls } from './types'
import { toFnCall } from './utils'

export abstract class ValidatorBase {
  layer2: L2Chain

  onchain: OnchainValidator

  offchain: OffchainValidator

  constructor(layer1: L1Contract, layer2: L2Chain) {
    this.layer2 = layer2
    this.onchain = new OnchainValidator(layer1)
    this.offchain = new OffchainValidator(layer2)
  }

  protected async validateHeader(block: Block): Promise<ValidateFnCalls> {
    const onchainValidator = this.onchain.header
    const offchainValidator = this.offchain.header
    const fnCalls: FnCall[] = [
      toFnCall('validateDepositRoot', block),
      toFnCall('validateMigrationRoot', block),
      toFnCall('validateTxRoot', block),
      toFnCall('validateTotalFee', block),
    ]
    return {
      onchainValidator,
      offchainValidator,
      fnCalls,
    }
  }

  protected async validateMassDeposit(block: Block): Promise<ValidateFnCalls> {
    const onchainValidator = this.onchain.deposit
    const offchainValidator = this.offchain.deposit
    const fnCalls: FnCall[] = Array.from(
      Array(block.body.massDeposits.length).keys(),
    ).map(index =>
      toFnCall('validateMassDeposit', block, Uint256.from(index.toString())),
    )
    return {
      onchainValidator,
      offchainValidator,
      fnCalls,
    }
  }

  protected async validateMassMigration(
    block: Block,
  ): Promise<ValidateFnCalls> {
    const onchainValidator = this.onchain.migration
    const offchainValidator = this.offchain.migration
    const validateDuplicatedDestinationCalls: FnCall[] = []
    const validateTotalEthCalls: FnCall[] = []
    const validateMergedLeavesCalls: FnCall[] = []
    const validateMigrationFeeCalls: FnCall[] = []
    const validateDuplicatedERC20MigrationCalls: FnCall[] = []
    const validateERC20AmountCalls: FnCall[] = []
    const validateDuplicatedERC721MigrationCalls: FnCall[] = []
    const validateNonFungibilityCalls: FnCall[] = []
    const validateNftExistenceCalls: FnCall[] = []
    for (let i = 0; i < block.body.massMigrations.length; i += 1) {
      for (let j = 0; j < block.body.massMigrations.length; j += 1) {
        validateDuplicatedDestinationCalls.push(
          toFnCall(
            'validateDuplicatedDestination',
            block,
            Uint256.from(i.toString()),
            Uint256.from(j.toString()),
          ),
        )
      }
      validateTotalEthCalls.push(
        toFnCall('validateTotalEth', block, Uint256.from(i.toString())),
      )
      validateMergedLeavesCalls.push(
        toFnCall('validateMergedLeaves', block, Uint256.from(i.toString())),
      )
      validateMigrationFeeCalls.push(
        toFnCall(
          onchainValidator.validateMigrationFee.name,
          block,
          Uint256.from(i.toString()),
        ),
      )
      for (let j = 0; j < block.body.massMigrations[i].erc20.length; j += 1) {
        for (let k = 0; k < block.body.massMigrations[i].erc20.length; k += 1) {
          validateDuplicatedERC20MigrationCalls.push(
            toFnCall(
              'validateDuplicatedERC20Migration',
              block,
              Uint256.from(i.toString()),
              Uint256.from(j.toString()),
              Uint256.from(k.toString()),
            ),
          )
        }
        validateERC20AmountCalls.push(
          toFnCall(
            'validateERC20Amount',
            block,
            Uint256.from(i.toString()),
            Uint256.from(j.toString()),
          ),
        )
      }
      for (let j = 0; j < block.body.massMigrations[i].erc721.length; j += 1) {
        for (
          let k = 0;
          k < block.body.massMigrations[i].erc721.length;
          k += 1
        ) {
          validateDuplicatedERC721MigrationCalls.push(
            toFnCall(
              'validateDuplicatedERC721Migration',
              block,
              Uint256.from(i.toString()),
              Uint256.from(j.toString()),
              Uint256.from(k.toString()),
            ),
          )
        }
        for (
          let k = 0;
          k < block.body.massMigrations[i].erc721[j].nfts.length;
          k += 1
        ) {
          validateNonFungibilityCalls.push(
            toFnCall(
              'validateNonFungibility',
              block,
              Uint256.from(i.toString()),
              Uint256.from(j.toString()),
              Uint256.from(
                block.body.massMigrations[i].erc721[j].nfts[k].toString(),
              ),
            ),
          )
          validateNftExistenceCalls.push(
            toFnCall(
              'validateNftExistence',
              block,
              Uint256.from(i.toString()),
              Uint256.from(j.toString()),
              Uint256.from(
                block.body.massMigrations[i].erc721[j].nfts[k].toString(),
              ),
            ),
          )
        }
      }
    }
    return {
      onchainValidator,
      offchainValidator,
      fnCalls: [
        ...validateDuplicatedDestinationCalls,
        ...validateTotalEthCalls,
        ...validateMergedLeavesCalls,
        ...validateMigrationFeeCalls,
        ...validateDuplicatedERC20MigrationCalls,
        ...validateERC20AmountCalls,
        ...validateDuplicatedERC721MigrationCalls,
        ...validateNonFungibilityCalls,
        ...validateNftExistenceCalls,
      ],
    }
  }

  protected async validateNullifierTree(
    block: Block,
    parent: Header,
  ): Promise<ValidateFnCalls> {
    assert(
      this.layer2.grove.nullifierTree,
      'Only full node can run this validation',
    )
    const currentRoot = await this.layer2.grove.nullifierTree.root()
    assert(
      parent.nullifierRoot.toBN().eq(currentRoot),
      'Only full node can run this validation',
    )
    const onchainValidator = this.onchain.nullifierTree
    const offchainValidator = this.offchain.nullifierTree
    const nullifiers = block.body.txs.reduce((list, tx) => {
      return [...list, ...tx.inflow.map(inflow => inflow.nullifier)]
    }, [] as BN[])
    const newRoot = await this.layer2.grove.nullifierTree.dryRunNullify(
      ...nullifiers,
    )
    if (newRoot.eq(block.header.nullifierRoot.toBN())) {
      // Valid nullifier tree transformation
      return {
        onchainValidator,
        offchainValidator,
        fnCalls: [],
      }
    }
    // Invalid transformation. Try to create a challenge tx
    const siblings: Bytes32[][] = []
    for (const tx of block.body.txs) {
      for (const inflow of tx.inflow) {
        const nonInclusionProof = await this.layer2.grove.nullifierTree.getNonInclusionProof(
          inflow.nullifier,
        )
        if (!nonInclusionProof.root.eq(parent.nullifierRoot.toBN())) {
          throw Error('Node has different nullifier root')
        }
        siblings.push(
          nonInclusionProof.siblings.map(sib =>
            Uint256.from(sib.toString()).toBytes(),
          ),
        )
      }
    }

    console.log('yes nullifier tree challenge')
    const fnCalls: FnCall[] = [
      toFnCall(
        'validateNullifierRollUp',
        block,
        parent,
        Uint256.from(siblings.length.toString()),
        siblings,
      ),
    ]
    return {
      onchainValidator,
      offchainValidator,
      fnCalls,
    }
  }

  protected async validateUtxoTree(
    block: Block,
    parent: Header,
  ): Promise<ValidateFnCalls> {
    const onchainValidator = this.onchain.utxoTree
    const offchainValidator = this.offchain.utxoTree
    const retrievedDeposits = await this.layer2.getDeposits(
      ...block.body.massDeposits,
    )
    const deposits = retrievedDeposits.map(deposit =>
      Field.from(deposit.note).toUint256(),
    )
    const startingLeafProof = this.layer2.grove.utxoTree.getStartingLeafProof()
    if (
      !parent.utxoRoot.toBN().eq(startingLeafProof.root) ||
      !parent.utxoIndex.toBN().eq(startingLeafProof.index)
    ) {
      throw Error('Utxo tree is returning invalid starting leaf proof.')
    }
    const fnCalls: FnCall[] = [
      toFnCall('validateUTXOIndex', block, parent, deposits),
      toFnCall(
        'validateUTXORoot',
        block,
        parent,
        deposits,
        startingLeafProof.siblings
          .slice(this.layer2.config.utxoSubTreeDepth)
          .map(sib => sib.toUint256()),
      ),
    ]
    return {
      onchainValidator,
      offchainValidator,
      fnCalls,
    }
  }

  protected async validateWithdrawalTree(
    block: Block,
    parent: Header,
  ): Promise<ValidateFnCalls> {
    const onchainValidator = this.onchain.withdrawalTree
    const offchainValidator = this.offchain.withdrawalTree
    const startingLeafProof = this.layer2.grove.withdrawalTree.getStartingLeafProof()
    if (
      !parent.withdrawalRoot.toBN().eq(startingLeafProof.root) ||
      !parent.withdrawalIndex.toBN().eq(startingLeafProof.index)
    ) {
      throw Error('Withdrawal tree is returning invalid starting leaf proof.')
    }
    const fnCalls: FnCall[] = [
      toFnCall('validateWithdrawalIndex', block, parent),
      toFnCall(
        'validateWithdrawalRoot',
        block,
        parent,
        startingLeafProof.siblings
          .slice(this.layer2.config.withdrawalSubTreeDepth)
          .map(sib => Uint256.from(sib.toString())),
      ),
    ]
    return {
      onchainValidator,
      offchainValidator,
      fnCalls,
    }
  }

  protected async validateTx(
    block: Block,
    parent: Header,
  ): Promise<ValidateFnCalls> {
    const onchainValidator = this.onchain.tx
    const offchainValidator = this.offchain.tx
    const validateInclusionCalls: FnCall[] = []
    const validateOutflowCalls: FnCall[] = []
    const validateAtomicSwapCalls: FnCall[] = []
    const validateUsedNullifierCalls: FnCall[] = []
    const validateDuplicatedNullifierCalls: FnCall[] = []
    const validateSNARKCalls: FnCall[] = []

    let usedNullifiers: BN[] | undefined
    if (this.layer2.grove.nullifierTree) {
      const nullifiers = block.body.txs.reduce((list, tx) => {
        return [...list, ...tx.inflow.map(inflow => inflow.nullifier)]
      }, [] as BN[])
      usedNullifiers = await this.layer2.grove.nullifierTree.findUsedNullifier(
        ...nullifiers,
      )
    }
    for (let i = 0; i < block.body.txs.length; i += 1) {
      for (let j = 0; j < block.body.txs[i].inflow.length; j += 1) {
        validateInclusionCalls.push(
          toFnCall(
            'validateInclusion',
            block,
            Uint256.from(i.toString()),
            Uint256.from(j.toString()),
          ),
        )
        if (
          this.layer2.grove.nullifierTree &&
          usedNullifiers?.find(n => block.body.txs[i].inflow[j].nullifier.eq(n))
        ) {
          const inclusionProof = await this.layer2.grove.nullifierTree.getInclusionProof(
            block.body.txs[i].inflow[j].nullifier,
          )
          if (!inclusionProof.root.eq(parent.nullifierRoot.toBN())) {
            throw Error('Node has different nullifier root')
          }
          validateUsedNullifierCalls.push(
            toFnCall(
              'validateUsedNullifier',
              block,
              headerHash,
              Uint256.from(i.toString()),
              Uint256.from(j.toString()),
              inclusionProof.siblings.map(sib =>
                Uint256.from(sib.toString()).toBytes(),
              ),
            ),
          )
        } else {
          logger.trace('This node does not have nullifier tree.')
        }
      }
      validateOutflowCalls.push(
        toFnCall('validateOutflow', block, Uint256.from(i.toString())),
      )
      if (block.body.txs[i].swap) {
        validateAtomicSwapCalls.push(
          toFnCall('validateAtomicSwap', block, Uint256.from(i.toString())),
        )
      }
      validateDuplicatedNullifierCalls.push(
        toFnCall(
          'validateDuplicatedNullifier',
          block,
          Uint256.from(i.toString()),
        ),
      )
      validateSNARKCalls.push(
        toFnCall('validateSNARK', block, Uint256.from(i.toString())),
      )
    }
    return {
      onchainValidator,
      offchainValidator,
      fnCalls: [
        ...validateInclusionCalls,
        ...validateOutflowCalls,
        ...validateAtomicSwapCalls,
        ...validateUsedNullifierCalls,
        ...validateDuplicatedNullifierCalls,
      ],
    }
  }

  abstract async validate(
    parent: Header,
    block: Block,
  ): Promise<ChallengeTx | undefined>

  protected abstract async executeValidateFnCalls(
    calls: ValidateFnCalls,
  ): Promise<ChallengeTx | undefined>
}
