const YTDlpWrap = require("yt-dlp-wrap").default;
const path = require("path");

async function downloadBinary() {
  try {
    console.log("Downloading yt-dlp binary...");
    const binaryPath = path.join(__dirname, "bin");

    const ytDlpWrap = new YTDlpWrap(binaryPath);
    await YTDlpWrap.downloadFromGithub(binaryPath);

    console.log("yt-dlp binary downloaded successfully to:", binaryPath);
  } catch (err) {
    console.error("Error downloading binary:", err);
  }
}

downloadBinary();
