import express, { RequestHandler } from 'express'
import { WithdrawalStatus, ZkTx } from '@zkopru/transaction'
import { logger } from '@zkopru/utils'
import { Server } from 'http'
import { soliditySha3Raw, toBN, toChecksumAddress } from 'web3-utils'
import { Bytes32 } from 'soltypes'
import { Fp } from '@zkopru/babyjubjub'
import { BootstrapData } from '@zkopru/core'
import { TxUtil } from '@zkopru/contracts'
import fetch from 'node-fetch'
import { verifyProof } from '@zkopru/tree'
import { CoordinatorContext } from './context'
import { ClientApi } from './client-api'

function catchError(fn: Function): RequestHandler {
  return async (req, res, next) => {
    try {
      await fn(req, res, next)
    } catch (err) {
      res.status(500).send(`Internal server error: ${err.toString()}`)
    }
  }
}

export class CoordinatorApi {
  context: CoordinatorContext

  server?: Server

  bootstrapCache: {
    [hash: string]: BootstrapData
  }

  clientApi: ClientApi

  constructor(context: CoordinatorContext) {
    this.context = context
    this.bootstrapCache = {}
    this.clientApi = new ClientApi(context)
  }

  start() {
    if (!this.server) {
      const app = express()
      app.use(express.text())
      // CORS/vhosts enforced only for RPC API
      const parseCommaList = (list = '') =>
        list
          .toLowerCase()
          .split(',')
          .filter(s => s.length > 0)
      const allowedHosts = parseCommaList(this.context.config.vhosts)
      const allowedDomains = parseCommaList(this.context.config.corsdomain)
      const corsMiddleware = (req, res, next) => {
        const host = (
          req.get('host') ||
          req.get('x-forwarded-host') ||
          ''
        ).toLowerCase()
        const hostname = host.split(':').shift()
        const wildcardHost = allowedHosts.indexOf('*') !== -1
        if (!wildcardHost && allowedHosts.indexOf(hostname) === -1) {
          const { jsonrpc, id } = req.body
          res
            .status(401)
            .json({ id, jsonrpc, message: `Host "${hostname}" disallowed` })
          return
        }
        const origin = (req.get('origin') || '').toLowerCase()
        const wildcardDomain = allowedDomains.indexOf('*') !== -1
        if (wildcardDomain) {
          res.set('Access-Control-Allow-Origin', '*')
        } else if (allowedDomains.indexOf(origin) !== -1) {
          res.set('Access-Control-Allow-Origin', origin)
        } else {
          res.set('Access-Control-Allow-Origin', '')
        }
        res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        res.set(
          'Access-Control-Allow-Headers',
          'Origin, Content-Type, Access-Control-Allow-Origin',
        )
        next()
      }
      app.use(corsMiddleware)
      app.post('/tx', catchError(this.txHandler))
      app.post('/txs', express.json(), catchError(this.multiTxHandler))
      app.post('/instant-withdraw', catchError(this.instantWithdrawHandler))
      app.get(
        '/instant-withdraw',
        express.json(),
        catchError(this.loadInstantWithdrawHandler),
      )
      if (this.context.config.bootstrap) {
        app.get('/bootstrap', catchError(this.bootstrapHandler))
      }
      app.get('/price', catchError(this.bytePriceHandler))
      app.post('/', express.json(), catchError(this.clientApiHandler))
      app.get('/fastsync', catchError(this.fastSync))
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
        this.server.close(() => res())
      } else {
        res()
      }
    })
  }

  private fastSync: RequestHandler = async (_, res) => {
    const stream = await this.context.node.layer2.grove.exportData()
    stream.pipe(res)
  }

  private clientApiHandler: RequestHandler = async (req, res) => {
    const { method, params, jsonrpc, id } = req.body
    if (jsonrpc !== '2.0') {
      res.status(400).json({
        id,
        message: 'Invalid jsonrpc version',
        jsonrpc: '2.0',
      })
      return
    }
    try {
      const result = await this.clientApi.callMethod(
        method,
        params,
        id,
        jsonrpc,
      )
      // The id at the top level of the response needs to be left as a number
      // we use this variable to avoid leaving other id variables as numbers
      let firstId = true
      const payload = JSON.stringify(
        {
          id,
          jsonrpc,
          result,
        },
        (key: any, value: any) => {
          if (firstId && key === 'id' && typeof value === 'number') {
            firstId = false
            return value
          }
          if (typeof value === 'number' || typeof value === 'bigint') {
            return `0x${value.toString(16)}`
          }
          return value
        },
      )
      res.send(payload)
    } catch (err) {
      res.status(400).json({
        id,
        jsonrpc,
        message: err.message,
      })
    }
  }

  private loadInstantWithdrawHandler: RequestHandler = async (_, res) => {
    const instantWithdrawals = await this.context.node.db.findMany(
      'InstantWithdrawal',
      {
        where: {},
        orderBy: { expiration: 'desc' },
        include: { withdrawal: { proposal: true } },
      },
    )
    const tokenAddresses = instantWithdrawals
      .filter(instant => !!instant.withdrawal)
      .map(({ withdrawal }) => withdrawal.tokenAddr)
      .filter(addr => +addr !== 0)
      .filter(addr => !!addr)
    const uniqTokenAddresses = [...new Set(tokenAddresses)]
    const tokenInfo = await this.context.node.loadERC20InfoByAddress(
      uniqTokenAddresses,
    )
    const tokenInfoByAddress = tokenInfo.reduce((acc, info) => {
      return {
        ...acc,
        [info.address.toLowerCase()]: info,
      }
    }, {})
    res.json(
      instantWithdrawals.map(instant => {
        if (!instant.withdrawal) return instant
        const { tokenAddr } = instant.withdrawal
        if (+tokenAddr === 0) return instant
        const info = tokenInfoByAddress[tokenAddr.toLowerCase()]
        if (!info) throw new Error('Unable to find info for token')
        return {
          ...instant,
          withdrawal: {
            ...instant.withdrawal,
            tokenInfo: info,
          },
        }
      }),
    )
  }

  private multiTxHandler: RequestHandler = async (req, res) => {
    const txs = req.body
    const zkTxs = [] as ZkTx[]
    for (const tx of txs) {
      const zkTx = ZkTx.decode(Buffer.from(tx, 'hex'))
      // const zkTx = ZkTx.decode(txData)
      const { layer2 } = this.context.node
      const result = await layer2.isValidTx(zkTx)
      if (!result) {
        logger.info('Failed to verify zk snark')
        res.status(500).send('Coordinator is not running')
        return
      }
      zkTxs.push(zkTx)
    }
    await this.context.txPool.addToTxPool(zkTxs)
    res.send(true)
    const { auctionMonitor } = this.context
    if (!auctionMonitor.isProposable) {
      const url = await auctionMonitor.functionalCoordinatorUrl(
        auctionMonitor.currentProposer,
      )
      if (!url) {
        logger.error(`No url to forward to!`)
        return
      }
      logger.info(`forwarding tx data to "${url}"`)
      try {
        const r = await fetch(`${url}/txs`, {
          method: 'post',
          body: txs,
        })
        if (!r.ok) {
          throw new Error(await r.text())
        }
      } catch (err) {
        logger.error(err)
        logger.error('Error forwarding transaction')
      }
    }
  }

  private txHandler: RequestHandler = async (req, res) => {
    const txData = req.body
    logger.info(`tx data ${typeof txData} ${txData}`)
    const { auctionMonitor } = this.context
    logger.info(`tx data is ${txData}`)
    logger.info(txData)
    const zkTx = ZkTx.decode(Buffer.from(txData, 'hex'))
    // const zkTx = ZkTx.decode(txData)
    const { layer2 } = this.context.node
    const result = await layer2.isValidTx(zkTx)
    if (!result) {
      logger.info('Failed to verify zk snark')
      res.status(500).send('Coordinator is not running')
      return
    }
    await this.context.txPool.addToTxPool(zkTx)
    res.send(result)
    // Immediately forward the transaction if needed
    if (!auctionMonitor.isProposable) {
      const url = await auctionMonitor.functionalCoordinatorUrl(
        auctionMonitor.currentProposer,
      )
      if (!url) {
        logger.error(`No url to forward to!`)
        return
      }
      logger.info(`forwarding tx data to "${url}"`)
      try {
        const r = await fetch(`${url}/tx`, {
          method: 'post',
          body: txData.toString(),
        })
        if (!r.ok) {
          throw new Error(await r.text())
        }
      } catch (err) {
        logger.error(err)
        logger.error('Error forwarding transaction')
      }
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
      prepayFeeInEth,
      prepayFeeInToken,
      includedIn,
      index,
      prepayer,
      expiration,
      signature,
    } = withdrawal
    if (
      toChecksumAddress(prepayer) !==
      toChecksumAddress(this.context.account.address)
    ) {
      res.status(400).send('This server does not have that prepayer account.')
      return
    }
    const withdrawalHash = soliditySha3Raw(
      hash,
      to,
      eth,
      tokenAddr,
      erc20Amount,
      nft,
      fee,
    )
    const tx = layer1.user.methods.payInAdvance(
      hash,
      [to, eth, tokenAddr, erc20Amount, nft, fee],
      [prepayer, withdrawalHash, prepayFeeInEth, prepayFeeInToken, expiration],
      signature,
    )

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
      expiration: parseInt(expiration, 10),
      siblings: JSON.stringify(withdrawal.siblings),
      status: WithdrawalStatus.UNFINALIZED,
    }
    const header = await layer2.db.findOne('Header', {
      where: {
        hash: includedIn,
      },
    })
    const proposal = await layer2.db.findOne('Proposal', {
      where: {
        hash: includedIn,
      },
    })
    if (!!header && proposal?.verified) {
      const proof = {
        root: toBN(header.withdrawalRoot),
        index: toBN(index),
        leaf: toBN(withdrawalHash),
        siblings: withdrawal.siblings.map(sib => toBN(sib)),
      }
      const isValidRequest = verifyProof(
        this.context.node.layer2.grove.config.withdrawalHasher,
        proof,
      )
      if (!isValidRequest) {
        res.status(400).send('API accepts only a single string')
        return
      }
      await layer2.db.upsert('Withdrawal', {
        where: { hash },
        create: data,
        update: data,
      })
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
      res.send(signedTx)
    } else {
      res.status(400).send('The withdrawal is not verified.')
    }
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
        leaf: Fp.zero.toHex(),
        siblings: block.bootstrap.utxoBootstrap.map(s => s.toString()),
      },
      withdrawalTreeIndex: block.bootstrap.withdrawalTreeIndex,
      withdrawalStartingLeafProof: {
        root: block.header.withdrawalRoot.toString(),
        index: block.header.withdrawalIndex.toString(),
        leaf: Fp.zero,
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
