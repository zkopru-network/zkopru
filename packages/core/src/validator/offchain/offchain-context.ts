import { L2Chain } from '../../context/layer2'

export class OffchainValidatorContext {
  layer2: L2Chain

  constructor(layer2: L2Chain) {
    this.layer2 = layer2
  }
}
