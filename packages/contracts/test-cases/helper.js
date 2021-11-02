const { toBN } = require("web3-utils");
const fs = require("fs");
const path = require("path");

const compare = (a, b) => {
  expect(toBN(a).toString()).equal(toBN(b).toString());
};

const sampleBlock = fs
  .readFileSync(path.join(__dirname, "block-2.txt"))
  .toString();

const sampleFirstBlock = fs
  .readFileSync(path.join(__dirname, "block-1.txt"))
  .toString();

module.exports = {
  compare,
  sampleBlock,
  sampleFirstBlock
};
