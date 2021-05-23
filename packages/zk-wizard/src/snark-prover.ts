import * as snarkjs from 'snarkjs'

export default async (data: {
  inputs: any
  wasmPath: string
  zKeyPath: string
  vKey: Record<string, any>
}): Promise<{ proof: any; publicSignals: any }> => {
  return new Promise<{ proof: any; publicSignals: any }>((res, rej) => {
    const { inputs, wasmPath, zKeyPath, vKey } = data
    try {
      snarkjs.groth16
        .fullProve(inputs, wasmPath, zKeyPath)
        .then(({ proof, publicSignals }) => {
          snarkjs.groth16
            .verify(vKey, publicSignals, proof)
            .then((validity: boolean) => {
              if (validity) {
                res({ proof, publicSignals })
              } else {
                rej(new Error(`Failed to generate SNARK proof`))
              }
            })
        })
    } catch (err) {
      rej(new Error(`SNARK full prove failure: ${err}`))
    }
  })
}
