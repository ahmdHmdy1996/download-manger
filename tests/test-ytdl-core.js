const ytdl = require("ytdl-core");
const fs = require("fs");

const url = "https://youtube.com/shorts/f8zA_OOBnNA?si=Yg-_jsIhdVuNWCdk";

async function run() {
  try {
    console.log("Validating URL...");
    const isValid = ytdl.validateURL(url);
    console.log("Is valid:", isValid);

    console.log("Fetching info...");
    const info = await ytdl.getInfo(url);
    console.log("Title:", info.videoDetails.title);

    console.log("Starting download...");
    ytdl(url, { quality: "highest" })
      .pipe(fs.createWriteStream("video-ytdl-core.mp4"))
      .on("finish", () => console.log("Done!"))
      .on("error", (err) => console.error("Stream Error:", err));
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
