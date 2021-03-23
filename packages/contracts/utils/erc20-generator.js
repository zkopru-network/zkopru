console.log("> Compiling ERC20");
const path = require("path");
const fs = require("fs");
// eslint-disable-next-line import/no-extraneous-dependencies
const solc = require("solc5");
// eslint-disable-next-line import/no-extraneous-dependencies
const Artifactor = require("@truffle/artifactor");

const erc20Code = fs.readFileSync("./utils/TestERC20.sol", "utf8");

const input = {
  language: "Solidity",
  sources: {
    "TestERC20.sol": {
      content: erc20Code
    }
  },
  settings: {
    outputSelection: {
      "*": {
        "*": ["*"]
      }
    }
  }
};
const output = JSON.parse(solc.compile(JSON.stringify(input)));
const sourceFile = output.contracts["TestERC20.sol"];
const contract = sourceFile.TestERC20;

const contractsDir = path.join(__dirname, "..", "build/generated");
const artifactor = new Artifactor(contractsDir);
fs.mkdirSync(contractsDir, { recursive: true });
(async () => {
  await artifactor.save({
    contractName: "TestERC20",
    abi: contract.abi,
    bytecode: contract.evm.bytecode.object
  });
})();
