import assert from 'assert'
import fs from 'fs'
import prove from './snark-prover'

process.on(
  'message',
  async (message: {
    inputs: any
    wasmPath: string
    zKeyPath: string
    vkPath: string
  }) => {
    assert(
      process.send,
      'It looks a master process. This should be a forked process',
    )
    try {
      const vKey = JSON.parse(fs.readFileSync(message.vkPath).toString())
      const snark = await prove(message, vKey)
      process.send({ snark })
    } catch (err) {
      process.send({ err })
    }
    process.exit(0)
  },
)
