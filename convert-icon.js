const fs = require("fs");
const path = require("path");

const inputFile = path.join(__dirname, "assets", "icon.png");
const outputFile = path.join(__dirname, "assets", "icon.ico");

// Check if ICO already exists and is valid
if (fs.existsSync(outputFile)) {
  const stats = fs.statSync(outputFile);
  if (stats.size > 0) {
    console.log(
      `Icon file already exists: ${outputFile} (${stats.size} bytes)`
    );
    console.log("Skipping conversion.");
    process.exit(0);
  }
}

if (!fs.existsSync(inputFile)) {
  console.error(`Input file not found: ${inputFile}`);
  process.exit(1);
}

(async () => {
  try {
    // Dynamic import for ESM compatibility
    const pngToIco = (await import("png-to-ico")).default;

    console.log(`Converting ${inputFile} to ${outputFile}...`);

    // png-to-ico returns a Promise that resolves to a buffer
    const buf = await pngToIco(inputFile);

    fs.writeFileSync(outputFile, buf);
    console.log(
      `Successfully converted to ${outputFile} (${buf.length} bytes)`
    );
  } catch (err) {
    console.error("Error converting icon:", err.message);

    // If conversion fails but ICO exists, warn but don't fail
    if (fs.existsSync(outputFile)) {
      console.warn("Using existing ICO file despite conversion error.");
      process.exit(0);
    }

    process.exit(1);
  }
})();
