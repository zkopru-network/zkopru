import express from 'express'
import { ZkTx } from '@zkopru/core'

export class API {
  app: express.Application

  port: number

  handlers: {
    txRequest?: (tx: ZkTx) => Promise<string>
  }

  constructor(config: { port: number }) {
    this.app = express()
    this.port = config.port
    this.handlers = {}
    this.app.post('/zkopru', async (req, res) => {
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
