const fs = require("fs");
const path = require("path");

const inputFile = path.join(__dirname, "assets", "icon.png");
const outputFile = path.join(__dirname, "assets", "icon.ico");

if (!fs.existsSync(inputFile)) {
  console.error(`Input file not found: ${inputFile}`);
  process.exit(1);
}

(async () => {
  try {
    // Dynamic import for ESM compatibility
    const pngToIco = (await import("png-to-ico")).default;

    // png-to-ico might return a Promise that resolves to a buffer
    const buf = await pngToIco(inputFile);

    fs.writeFileSync(outputFile, buf);
    console.log(`Successfully converted ${inputFile} to ${outputFile}`);
  } catch (err) {
    console.error("Error converting icon:", err);
    process.exit(1);
  }
})();
