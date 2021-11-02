console.log("> Generating abi json files");
const path = require("path");
const fs = require("fs");
// eslint-disable-next-line import/no-extraneous-dependencies
const prettier = require("prettier");

const contracts = fs.readdirSync("./build/contracts");
fs.mkdirSync("./build/abis", { recursive: true });
fs.mkdirSync("./src/abis", { recursive: true });
for (const contract of contracts) {
  const artifact = JSON.parse(
    fs.readFileSync(`./build/contracts/${contract}`, "utf8")
  );

  const name = contract.split(".json")[0];
  const src = `export const ${name}ABI = ${JSON.stringify(artifact.abi)}`;
  const formatted = prettier.format(src, {
    semi: false,
    parser: "babel",
    singleQuote: true
  });
  fs.writeFileSync(`./src/abis/${name}.ts`, formatted);
}
