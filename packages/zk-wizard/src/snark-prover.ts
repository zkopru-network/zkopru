import * as snarkjs from 'snarkjs'
import * as ffjs from 'ffjavascript'

export default async (data: {
  inputs: any
  wasmPath: string
  zKeyPath: string
  vkPath: string
}, vKey: Object) => {
  try {
    const { inputs, wasmPath, zKeyPath } = data
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      ffjs.utils.unstringifyBigInts(inputs),
      wasmPath,
      zKeyPath,
    )
    // const vKey = JSON.parse(fs.readFileSync(vkPath).toString())
    const validity = await snarkjs.groth16.verify(vKey, publicSignals, proof)
    if (!validity) {
      throw new Error(`Failed to generate SNARK proof`)
    }
    return { proof, publicSignals }
  } catch (err) {
    throw new Error(`SNARK runtime error ${err}`)
  }
}
