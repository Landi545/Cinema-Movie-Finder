const fs = require("node:fs");
const path = require("node:path");

// Dołączamy licencje bibliotek wbudowanych w parser na obu platformach.
module.exports = function copyParserLicenses(destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const name of ["htmlparser2", "domutils", "domhandler", "domelementtype", "dom-serializer", "entities"]) {
    fs.copyFileSync(path.resolve(__dirname, "../node_modules", name, "LICENSE"), path.join(destination, name + ".txt"));
  }
};
