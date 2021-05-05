import * as snarkjs from 'snarkjs'

export default async (data: {
  inputs: any
  wasmPath: string
  zKeyPath: string
  vKey: Record<string, any>
}) => {
  try {
    const { inputs, wasmPath, zKeyPath, vKey } = data
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      inputs,
      wasmPath,
      zKeyPath,
    )
    const validity = await snarkjs.groth16.verify(vKey, publicSignals, proof)
    if (!validity) {
      throw new Error(`Failed to generate SNARK proof`)
    }
    return { proof, publicSignals }
  } catch (err) {
    throw new Error(`SNARK runtime error ${err}`)
  }
}
