import { L1Contract } from '../../context/layer1'

export class OnchainValidatorContext {
  layer1: L1Contract

  constructor(layer1: L1Contract) {
    this.layer1 = layer1
  }
}
