import express, { RequestHandler } from 'express'
import { WithdrawalStatus, ZkTx } from '@zkopru/transaction'
import { logger } from '@zkopru/utils'
import { Server } from 'http'
import { soliditySha3Raw } from 'web3-utils'
import { Bytes32 } from 'soltypes'
import { Field } from '@zkopru/babyjubjub'
import { BootstrapData } from '@zkopru/core'
import { TxUtil } from '@zkopru/contracts'
import { CoordinatorContext } from './context'

export class CoordinatorApi {
  context: CoordinatorContext

  server?: Server

  bootstrapCache: {
    [hash: string]: BootstrapData
  }

  constructor(context: CoordinatorContext) {
    this.context = context
    this.bootstrapCache = {}
  }

  start() {
    if (!this.server) {
      const app = express()
      app.use(express.text())
      app.post('/tx', this.txHandler)
      app.post('/instant-withdraw', this.instantWithdrawHandler)
      if (this.context.config.bootstrap) {
        app.get('/bootstrap', this.bootstrapHandler)
      }
      app.get('/price', this.bytePriceHandler)
      this.server = app.listen(this.context.config.port, () => {
        logger.info(
          `coordinator.js: API is running on serverPort ${this.context.config.port}`,
        )
      })
    }
  }

  async stop(): Promise<void> {
    return new Promise(res => {
      if (this.server) {
        this.server.close(async () => {
          res()
        })
      } else {
        res()
      }
    })
  }

  private txHandler: RequestHandler = async (req, res) => {
    const txData = req.body
    logger.info(`tx data is${txData}`)
    logger.info(txData)
    const zkTx = ZkTx.decode(Buffer.from(txData, 'hex'))
    // const zkTx = ZkTx.decode(txData)
    const { layer2 } = this.context.node
    const result = await layer2.snarkVerifier.verifyTx(zkTx)
    if (result) {
      logger.info('add a transaction')
      await this.context.txPool.addToTxPool(zkTx)
      res.send(result)
    } else {
      logger.info('Failed to verify zk snark')
      res.status(500).send('Coordinator is not running')
    }
  }

  private instantWithdrawHandler: RequestHandler = async (req, res) => {
    const { layer1, layer2 } = this.context.node
    const withdrawalData = req.body
    const withdrawal = JSON.parse(withdrawalData)
    const {
      hash,
      to,
      eth,
      tokenAddr,
      erc20Amount,
      nft,
      fee,
      includedIn,
      index,
      sign,
    } = withdrawal
    // TODO verify request
    // TODO check fee
    const tx = layer1.user.methods.payInAdvance(
      hash,
      to,
      eth,
      tokenAddr,
      erc20Amount,
      nft,
      fee,
      sign.signature,
    )
    const withdrawalHash = soliditySha3Raw(
      hash,
      to,
      eth,
      tokenAddr,
      erc20Amount,
      nft,
      fee,
    )
    const signedTx = await TxUtil.getSignedTransaction(
      tx,
      layer1.address,
      layer1.web3,
      this.context.account,
      {
        value: eth,
      },
    )
    // save withdrawal
    logger.info('pay in advance')
    const data = {
      hash,
      withdrawalHash,
      to,
      eth,
      tokenAddr,
      erc20Amount,
      nft,
      fee,
      includedIn,
      index,
      siblings: JSON.stringify(withdrawal.siblings),
      status: WithdrawalStatus.UNFINALIZED,
    }
    await layer2.db.write(prisma =>
      prisma.withdrawal.upsert({
        where: { hash },
        create: data,
        update: data,
      }),
    )
    res.send(signedTx)
  }

  private bootstrapHandler: RequestHandler = async (req, res) => {
    const { layer1, layer2 } = this.context.node
    const { hash } = req.query
    logger.info(`bootstrap called for ${hash}`)
    let hashForBootstrapBlock: string
    if (typeof hash !== 'string') {
      logger.info('Api accepts only a single string obj')
      res.status(500).send('API accepts only a single string')
      return
    }
    if (hash) {
      hashForBootstrapBlock = hash
    } else {
      hashForBootstrapBlock = await layer1.upstream.methods.latest().call()
    }
    if (this.bootstrapCache[hashForBootstrapBlock]) {
      res.send(this.bootstrapCache[hashForBootstrapBlock])
    }
    const blockHash = Bytes32.from(hashForBootstrapBlock)
    const block = await layer2.getBlock(blockHash)
    const proposal = await layer2.getProposal(blockHash)
    if (!proposal) {
      const message = `Failed to find a proposal for the requested  ${hash}`
      logger.info(message)
      res.status(500).send(message)
      return
    }
    if (!block) {
      const message = `Failed to find the requested block ${hash}`
      logger.info(message)
      res.status(500).send(message)
      return
    }
    if (!block.bootstrap) {
      const message = `Bootstrap for the requested block ${hash} does not exist`
      logger.info(message)
      res.status(500).send(message)
      return
    }
    res.send({
      proposalTx: proposal.proposalTx,
      blockHash: block.hash,
      utxoTreeIndex: block.bootstrap.utxoTreeIndex,
      utxoStartingLeafProof: {
        root: block.header.utxoRoot.toString(),
        index: block.header.utxoIndex.toString(),
        leaf: Field.zero.toHex(),
        siblings: block.bootstrap.utxoBootstrap.map(s => s.toString()),
      },
      withdrawalTreeIndex: block.bootstrap.withdrawalTreeIndex,
      withdrawalStartingLeafProof: {
        root: block.header.withdrawalRoot.toString(),
        index: block.header.withdrawalIndex.toString(),
        leaf: Field.zero,
        siblings: block.bootstrap.withdrawalBootstrap.map(s => s.toString()),
      },
    })
  }

  private bytePriceHandler: RequestHandler = async (_, res) => {
    const weiPerByte: string | undefined = this.context.gasPrice
      ?.muln(this.context.config.priceMultiplier)
      .toString(10)
    res.send({ weiPerByte })
  }
}
