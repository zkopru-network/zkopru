import { ZkTx } from "@zkopru/transaction"
import { VerifyingKey, verifyZkTx } from './snark'

process.on('message', async (message: { tx: ZkTx; vk: VerifyingKey }) => {
  const { tx, vk } = message
  let result!: boolean
  try {
    result = await verifyZkTx(tx, vk)
  } catch {
    result = false
  }
  // send response to master process
  if (process.send) {
    process.send({ result })
  } else {
    throw Error('It looks a master process. This should be a forked process')
  }
})
