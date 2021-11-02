include "../node_modules/circomlib/circuits/bitify.circom";

template RangeLimit(bitLength) {
  signal input in;
  // bitLength should be less than the SNARK field's bit length
  assert(bitLength < 254);
  // This automatically limits its max value to 2**bitLength - 1
  component bits = Num2Bits(bitLength);
  bits.in <== in;
}