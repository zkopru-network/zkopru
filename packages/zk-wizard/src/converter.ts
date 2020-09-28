import * as ffjs from 'ffjavascript'
import bigInt from 'big-integer'
import assert from 'assert'

export function witnessToBinary(witness: any[]): ArrayBuffer {
  const w = ffjs.utils.unstringifyBigInts(witness)
  const size = w.length * 32
  const buff = new ArrayBuffer(size)
  const h = {
    dataView: new DataView(buff),
    offset: 0,
  }

  function writeUint32(val) {
    h.dataView.setUint32(h.offset, val, true)
    h.offset += 4
  }

  function writeBigInt(bi) {
    for (let i = 0; i < 8; i += 1) {
      const v = bigInt(bi)
        .shiftRight(i * 32)
        .and(0xffffffff)
        .toJSNumber()
      writeUint32(v)
    }
  }

  for (let i = 0; i < w.length; i += 1) {
    writeBigInt(w[i])
  }
  assert.equal(h.offset, size)
  return buff
}

export function pkToBinary(pk: object): ArrayBuffer {
  const provingKey = ffjs.utils.unstringifyBigInts(pk)
  function polSize(pol: object) {
    const l = Object.keys(pol).length
    return 36 * l + 4
  }

  let size = 40

  // alpha1, beta1, delta1
  size += 3 * (32 * 2)

  // beta2, delta2
  size += 2 * (32 * 4)

  for (let i = 0; i < provingKey.nVars; i += 1) {
    size += polSize(provingKey.polsA[i])
    size += polSize(provingKey.polsB[i])
  }

  size += provingKey.nVars * (32 * 2)
  size += provingKey.nVars * (32 * 2)
  size += provingKey.nVars * (32 * 4)
  size += (provingKey.nVars - provingKey.nPublic - 1) * (32 * 2)
  size += provingKey.domainSize * (32 * 2)

  const buffLen = size

  const buff = new ArrayBuffer(buffLen)

  const h = {
    dataView: new DataView(buff),
    offset: 0,
  }
  function writeUint32(val) {
    h.dataView.setUint32(h.offset, val, true)
    h.offset += 4
  }

  function writeUint32ToPointer(p, val) {
    h.dataView.setUint32(p, val, true)
  }

  function alloc(n) {
    const o = h.offset
    h.offset += n
    return o
  }

  function writeBigInt(bi) {
    for (let i = 0; i < 8; i += 1) {
      const v = bi
        .shiftRight(i * 32)
        .and(0xffffffff)
        .toJSNumber()
      writeUint32(v)
    }
  }

  function toMontgomeryQ(p) {
    const q = bigInt(
      '21888242871839275222246405745257275088696311157297823662689037894645226208583',
    )
    return bigInt(p)
      .times(bigInt.one.shiftLeft(256))
      .mod(q)
  }

  function toMontgomeryR(p) {
    const r = bigInt(
      '21888242871839275222246405745257275088548364400416034343698204186575808495617',
    )
    return bigInt(p)
      .times(bigInt.one.shiftLeft(256))
      .mod(r)
  }

  function writePoint(p) {
    writeBigInt(toMontgomeryQ(p[0]))
    writeBigInt(toMontgomeryQ(p[1]))
  }

  function writePoint2(p) {
    writeBigInt(toMontgomeryQ(p[0][0]))
    writeBigInt(toMontgomeryQ(p[0][1]))
    writeBigInt(toMontgomeryQ(p[1][0]))
    writeBigInt(toMontgomeryQ(p[1][1]))
  }

  function writeTransformedPolynomial(p) {
    const keys = Object.keys(p)

    writeUint32(keys.length)

    for (let i = 0; i < keys.length; i += 1) {
      writeUint32(keys[i])
      writeBigInt(toMontgomeryR(p[keys[i]]))
    }
  }

  writeUint32(provingKey.nVars)
  writeUint32(provingKey.nPublic)
  writeUint32(provingKey.domainSize)
  const pPolsA = alloc(4)
  const pPolsB = alloc(4)
  const pPointsA = alloc(4)
  const pPointsB1 = alloc(4)
  const pPointsB2 = alloc(4)
  const pPointsC = alloc(4)
  const pPointsHExps = alloc(4)

  writePoint(provingKey.vk_alpha_1)
  writePoint(provingKey.vk_beta_1)
  writePoint(provingKey.vk_delta_1)
  writePoint2(provingKey.vk_beta_2)
  writePoint2(provingKey.vk_delta_2)

  writeUint32ToPointer(pPolsA, h.offset)
  for (let i = 0; i < provingKey.nVars; i += 1) {
    writeTransformedPolynomial(provingKey.polsA[i])
  }

  writeUint32ToPointer(pPolsB, h.offset)
  for (let i = 0; i < provingKey.nVars; i += 1) {
    writeTransformedPolynomial(provingKey.polsB[i])
  }

  writeUint32ToPointer(pPointsA, h.offset)
  for (let i = 0; i < provingKey.nVars; i += 1) {
    writePoint(provingKey.A[i])
  }

  writeUint32ToPointer(pPointsB1, h.offset)
  for (let i = 0; i < provingKey.nVars; i += 1) {
    writePoint(provingKey.B1[i])
  }

  writeUint32ToPointer(pPointsB2, h.offset)
  for (let i = 0; i < provingKey.nVars; i += 1) {
    writePoint2(provingKey.B2[i])
  }

  writeUint32ToPointer(pPointsC, h.offset)
  for (let i = provingKey.nPublic + 1; i < provingKey.nVars; i += 1) {
    writePoint(provingKey.C[i])
  }

  writeUint32ToPointer(pPointsHExps, h.offset)
  for (let i = 0; i < provingKey.domainSize; i += 1) {
    writePoint(provingKey.hExps[i])
  }

  return buff
}
