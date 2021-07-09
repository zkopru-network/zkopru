import assert from 'assert'
import { SNARKVerifier } from '@zkopru/core'
import { ZkTx, OutflowType } from '@zkopru/transaction'

const queuedTransactions = [] as any[]
let snarkVerifier: SNARKVerifier
const erc20Tokens = {} as { [addr: string]: boolean }

async function isValidTx(txData: string): Promise<boolean> {
  const zkTx = ZkTx.decode(Buffer.from(txData, 'hex'))
  // 1. verify snark
  const snarkResult = await snarkVerifier.verifyTx(zkTx)
  if (!snarkResult) return false

  // 2. try to find invalid outflow
  for (const outflow of zkTx.outflow) {
    if (outflow.outflowType.eqn(OutflowType.UTXO)) {
      if (outflow.data !== undefined) return false
    } else if (outflow.outflowType.eqn(OutflowType.MIGRATION)) {
      if (outflow.data === undefined) return false
      if (!outflow.data.nft.eqn(0)) return false // migration cannot have nft
      if (outflow.data.tokenAddr.eqn(0) && !outflow.data.erc20Amount.eqn(0))
        return false // migration cannot have nft
      if (!outflow.data.tokenAddr.eqn(0)) {
        return erc20Tokens[outflow.data.tokenAddr.toString().toLowerCase()]
      }
    }
  }
  return true
}

let processing = false
async function processTxs() {
  assert(process.send, 'This should be a forked process')
  if (queuedTransactions.length === 0 || processing) return
  processing = true
  const { txData, txId } = queuedTransactions.shift()
  try {
    const isValid = await isValidTx(txData)
    process.send({ txId, isValid })
  } catch (err) {
    process.send({ txId, isValid: false })
  }
  processing = false
  await processTxs()
}

process.on('message', async ({ txData, txId, vks, tokenAddresses }) => {
  assert(process.send, 'This should be a forked process')
  if (tokenAddresses) {
    for (const address of tokenAddresses) {
      erc20Tokens[address.toLowerCase()] = true
    }
  }
  if (vks) {
    // setup the snark verifier
    snarkVerifier = new SNARKVerifier(vks)
  }
  if (txData && txId) {
    queuedTransactions.push({ txData, txId })
  }
  try {
    if (snarkVerifier) {
      await processTxs()
    }
  } catch (err) {
    process.send({ err: err.message })
  }
})
