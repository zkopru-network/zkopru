const fs = require("fs");
const path = require("path");

function scanPath(dir) {
  const files = fs.readdirSync(dir);
  return files.map(name => path.join(dir, name));
}

const allFiles = [
  ...scanPath(path.join(__dirname, "test")),
  ...scanPath(path.join(__dirname, "test/controllers")),
  ...scanPath(path.join(__dirname, "test/libraries")),
  ...scanPath(path.join(__dirname, "test/validators"))
];

for (const file of allFiles) {
  // eslint-disable-next-line no-continue
  if (file.indexOf(".soltest.js") === -1) continue;
  require(file);
}
