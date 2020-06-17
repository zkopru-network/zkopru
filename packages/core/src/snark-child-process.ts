import * as snarkjs from 'snarkjs'
import * as ffjs from 'ffjavascript'

process.on(
  'message',
  async (message: { vk: string; proof: string; signals: string }) => {
    const { vk, proof, signals } = message
    let result!: boolean
    try {
      result = snarkjs.groth.isValid(
        ffjs.utils.unstringifyBigInts(vk),
        ffjs.utils.unstringifyBigInts(proof),
        ffjs.utils.unstringifyBigInts(signals),
      )
    } catch {
      result = false
    }
    // send response to master process
    if (process.send) {
      process.send({ result })
    } else {
      throw Error('It looks a master process. This should be a forked process')
    }
  },
)
