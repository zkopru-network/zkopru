import { ZkAddress } from '@zkopru/transaction'
import { Fp, Point } from '@zkopru/babyjubjub'

describe('zkAddress', () => {
  Array(50)
    .fill(null)
    .forEach((_, i) => {
      it(`should be able to encode and decode correctly ${i + 1}/ 50`, () => {
        const dummyPubSK = Fp.from(123432 + i)
        const dummyN = Point.generate(1000 + i)
        const zkAddr = ZkAddress.from(dummyPubSK, dummyN)
        const recovered = ZkAddress.fromBuffer(zkAddr.toBuffer())
        expect(zkAddr.toString()).toStrictEqual(recovered.toString())
      })
    })
})
