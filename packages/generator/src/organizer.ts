import Web3 from 'web3'
import express from 'express'
import { Transaction, TransactionReceipt } from 'web3-core'
import { logger } from '@zkopru/utils'
import { logAll, startLogger } from './generator-utils'
import { config } from './config'

startLogger('ORGANIZER_LOG')

const proposeData: {
  timestamp: number
  proposed: number
  txcount: number
}[] = []

export async function main() {
  logger.info('Organizer Initializing')

  const webSocketProvider = new Web3.providers.WebsocketProvider(
    config.testnetUrl,
    {
      reconnect: { auto: true },
    },
  )

  const web3 = new Web3(webSocketProvider)

  // Logging Start block
  logger.info(`Current Block Number ${await web3.eth.getBlockNumber()}`)

  const app = express()
  const PORT = 8080 // TODO: flexible

  app.use(express.text())
  app.get('/tps', (_, res) => {
    let previousProposeTime: number
    const response = proposeData.map(data => {
      if (data.proposed == 0) {
        previousProposeTime = data.timestamp
      }
      const duration = Math.floor((data.timestamp - previousProposeTime) / 1000)
      return {
        proposalNum: data.proposed,
        duration,
        txcount: data.txcount,
        tps: data.txcount / duration,
      }
    })
    res.send(response)
  })
  app.post('/propose', async (req, res) => {
    try {
      const data = JSON.parse(req.body)
      proposeData.push({
        timestamp: data.timestamp,
        proposed: data.proposed,
        txcount: data.txcount,
      })
      res.sendStatus(200)
    } catch (err) {
      res.status(500).send(`Organizer server error: ${err.toString()}`)
    }
  })
  app.listen(PORT, () => {
    logger.info(`[Organizer] Server is running`)
  })

  web3.eth
    .subscribe('newBlockHeaders')
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .on('data', async function(data) {
      const blockData = await web3.eth.getBlock(data.hash)
      const txs: Promise<Transaction>[] = []
      const receipts: Promise<TransactionReceipt>[] = []
      if (blockData.transactions) {
        blockData.transactions.forEach(txHash => {
          txs.push(web3.eth.getTransaction(txHash))
          receipts.push(web3.eth.getTransactionReceipt(txHash))
        })
      }
      const txData = Promise.all(txs)
      const receiptData = Promise.all(receipts)

      // TODO : await transaction data on layer1
      logger.info(`Found txs : ${logAll(txData)}`)
      logger.info(`Found receipts : ${logAll(receiptData)}`)
    })
}

main()
