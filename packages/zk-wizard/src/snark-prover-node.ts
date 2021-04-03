import assert from 'assert'
import prove from './snark-prover'

process.on(
  'message',
  async (message: {
    inputs: any
    wasmPath: string
    zKeyPath: string
    vKey: Record<string, any>
  }) => {
    assert(
      process.send,
      'It looks a master process. This should be a forked process',
    )
    try {
      const snark = await prove(message)
      process.send({ snark })
    } catch (err) {
      process.send({ err })
    }
    process.exit(0)
  },
)
