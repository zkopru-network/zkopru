import express from 'express'
import { ZkTx } from '@zkopru/transaction'
import { BootstrapData } from '@zkopru/core'

export class API {
  app: express.Application

  port: number

  handlers: {
    txRequest?: (tx: ZkTx) => Promise<string>
  }

  bootstrapCache?: BootstrapData

  constructor(config: { port: number }) {
    this.app = express()
    this.port = config.port
    this.handlers = {}
    this.app.get('/bootstrap', async (_, res) => {
      if (this.bootstrapCache) res.send(this.bootstrapCache)
    })
    this.app.post('/tx', async (req, res) => {
      const tx = ZkTx.decode(req.body)
      if (this.handlers.txRequest) {
        const result = await this.handlers.txRequest(tx)
        res.send(result)
      } else {
        throw Error('Tx handler does not exist. run start() first')
      }
    })
  }

  start() {
    this.app.listen(this.port, () =>
      console.log(`Coordination API is running on port ${this.port}`),
    )
  }

  onTxRequest(handler: (tx: ZkTx) => Promise<string>): void {
    this.handlers.txRequest = handler
  }
}
