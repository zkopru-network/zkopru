import fs from 'fs'
// eslint-disable-next-line import/no-extraneous-dependencies
import shell from 'shelljs'

const BUILD = './build/test'
const POWERS_OF_TAU_PHASE_1 = './build/ptau/pot17_final.ptau'

export const getArtifactPaths = (filename: string) => {
  const circuit = `./tester/${filename}`
  const r1cs = `${BUILD}/circuits/${filename}.r1cs`
  const wasm = `${BUILD}/circuits/${filename}.wasm`
  const sym = `${BUILD}/circuits/${filename}.sym`
  const zkey = `${BUILD}/zkeys/${filename}.zkey`
  const finalZkey = `${BUILD}/zkeys/${filename}.final.zkey`
  const vk = `${BUILD}/vks/${filename}.vk.json`
  const phase1 = POWERS_OF_TAU_PHASE_1
  return {
    circuit,
    r1cs,
    wasm,
    sym,
    phase1,
    zkey,
    finalZkey,
    vk,
  }
}

export const prepareArtifactsDirectory = () => {
  fs.mkdirSync(`${BUILD}/circuits`, { recursive: true })
  fs.mkdirSync(`${BUILD}/vks`, { recursive: true })
  fs.mkdirSync(`${BUILD}/zkeys`, { recursive: true })
}

/**
 * @description Simplified shelljs wrapper for Jest
 * @param cmd unix command
 */
export const sh = (cmd: string) => {
  const result = shell.exec(cmd)
  if (result.code !== 0) {
    throw Error(result)
  }
}

/**
 * @description If this throws Error you should run './scripts/powers_of_tau_phase_1.sh'
 */
export const checkPhase1Setup = () => {
  if (!fs.existsSync(POWERS_OF_TAU_PHASE_1)) {
    throw Error(
      'Download or build the powers of tau phase 1. Run "./scripts/powers_of_tau_phase_1.sh"',
    )
  }
}

/**
 * @param fileName Testing circuit's file name.
 * @param option By default, it skips compiling if the artifacts alreasy exist.
 */
export const compileCircuit = (
  fileName: string,
  option?: { overwrite?: boolean },
) => {
  const artifacts = getArtifactPaths(fileName)
  const { circuit, r1cs, wasm, sym } = artifacts
  if (!option?.overwrite) {
    const circuitExist = fs.existsSync(circuit)
    const r1csExist = fs.existsSync(r1cs)
    const wasmExist = fs.existsSync(wasm)
    const symExist = fs.existsSync(sym)
    if (circuitExist && r1csExist && wasmExist && symExist) {
      console.log(
        [
          `Artifacts are found.`,
          `Pass { overwrite: true } for compileCircuit's second parameter`,
          `if you want to update the circuit.`,
        ].join(' '),
      )
      return
    }
  }
  sh(
    `node --stack-size=8192 $(which circom) "${circuit}" -r "${r1cs}"  -w "${wasm}" -s ${sym}`,
  )
}

/**
 * @param fileName Testing circuit's file name.
 * @param option By default, it skips phase 2 setup if the artifacts alreasy exist.
 */
export const phase2Setup = (
  fileName: string,
  option?: { overwrite?: boolean },
) => {
  const artifacts = getArtifactPaths(fileName)
  const { phase1, r1cs, zkey, finalZkey, vk } = artifacts
  if (!option?.overwrite) {
    const finalZKeyExist = fs.existsSync(finalZkey)
    const vkExist = fs.existsSync(vk)
    if (finalZKeyExist && vkExist) {
      console.log(
        [
          `Artifacts are found.`,
          `Pass { overwrite: true } for phase2Setup's second parameter`,
          `if you have updated the circuit.`,
        ].join(' '),
      )
      return
    }
  }
  const tmpDir = `build/tmp/${fileName}`
  const commands = [
    `snarkjs zkey new ${r1cs} ${phase1} ${zkey}`,
    `snarkjs zkey verify ${r1cs} ${phase1} ${zkey}`,
    `snarkjs zkey beacon ${zkey} ${finalZkey} 0102030405060708090a0b0c0d0e0f101112131415161717191a1b1c1d1e1f 10 -n="Final Beacon phase2"`,
    `snarkjs zkey verify ${r1cs} ${phase1} ${finalZkey}`,
    `mkdir -p ${tmpDir}`,
    `cp ${finalZkey} ${tmpDir}`,
    `cd ${tmpDir} && snarkjs zkey export verificationkey ${fileName}.final.zkey`,
    `mv ${tmpDir}/verification_key.json ${vk}`,
    `rm -rf ${tmpDir}`,
  ]
  commands.forEach(sh)
}
