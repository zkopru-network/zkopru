const fs = require("fs");

const save = deployed => {
  const data = JSON.stringify(deployed, null, 2);
  if (!fs.existsSync("build/deployed")) {
    fs.mkdirSync("build/deployed");
  }
  fs.writeFileSync(`build/deployed/${deployed.name}.json`, data);
};

module.exports = save;
