console.log("> Generating bin files");
const path = require("path");
const fs = require("fs");
// eslint-disable-next-line import/no-extraneous-dependencies
const prettier = require("prettier");
const truffleConfig = require("../truffle-config.js");

const contracts = fs.readdirSync("./build/contracts");
fs.mkdirSync("./build/bin", { recursive: true });
fs.mkdirSync("./src/abis", { recursive: true });
const deployed = {};
for (const contract of contracts) {
  const artifact = JSON.parse(
    fs.readFileSync(`./build/contracts/${contract}`, "utf8")
  );

  const name = contract.split(".json")[0];
  // console.log(artifact.bytecode)
  const networks = {};
  Object.values(truffleConfig.networks).forEach(config => {
    if (artifact.networks[config.network_id.toString()]) {
      networks[config.network_id] = artifact.networks[config.network_id];
      const src = `
const ${name} = {
  at: ${JSON.stringify(networks)}
}`;
      const formatted = prettier.format(src, {
        semi: false,
        trailingComma: "es5",
        parser: "babel",
        singleQuote: true
      });
      deployed[name] = formatted;
    }
  });
}

const result = `${Object.values(deployed).join("")}
export const address = {${Object.keys(deployed).reduce((prev, name) => {
  return `${prev}
  ${name},`;
}, "")}
}
`;

fs.writeFileSync(`./src/address.ts`, result);
