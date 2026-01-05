const fs = require("fs");
const pngToIco = require("png-to-ico");

const inputFile = "assets/icon.png";
const outputFile = "assets/icon.ico";

if (!fs.existsSync(inputFile)) {
  console.error(`Input file not found: ${inputFile}`);
  process.exit(1);
}

pngToIco(inputFile)
  .then((buf) => {
    fs.writeFileSync(outputFile, buf);
    console.log(`Successfully converted ${inputFile} to ${outputFile}`);
  })
  .catch((err) => {
    console.error("Error converting icon:", err);
    process.exit(1);
  });
