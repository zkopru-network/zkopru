import { HexString, NumString } from "soltypes";
import { BigNumberish } from "ethers";
import { Fp } from "~babyjubjub";
import fs from "fs";
import path from "path";
import { expect } from "chai";

type CompareType = HexString | NumString | BigNumberish | undefined;

export const compare = (a: CompareType, b: CompareType) => {
  if (!!a && !!b) {
    expect(Fp.from(a.toString()).toHexString()).equal(
      Fp.from(b.toString()).toHexString()
    );
  } else {
    expect(a === b);
  }
};
export const sampleBlock = fs
  .readFileSync(path.join(__dirname, "block-2.txt"))
  .toString();

export const sampleFirstBlock = fs
  .readFileSync(path.join(__dirname, "block-1.txt"))
  .toString();
