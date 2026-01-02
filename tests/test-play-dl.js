const play = require("play-dl");
const fs = require("fs");

const url = "https://youtube.com/shorts/f8zA_OOBnNA?si=Yg-_jsIhdVuNWCdk";

async function run() {
  try {
    console.log("Validating URL...");
    const isValid = play.yt_validate(url);
    console.log("Is valid:", isValid);

    if (isValid !== "video") {
      console.log("Not a valid video URL");
      return;
    }

    console.log("Fetching info...");
    const info = await play.video_info(url);
    console.log("Title:", info.video_details.title);

    console.log("Getting stream...");
    const stream = await play.stream(url);
    console.log("Stream URL:", stream.url);
    console.log("Stream type:", stream.type);

    console.log("Starting download...");
    const response = await fetch(stream.url);
    const fileStream = fs.createWriteStream("video-play-dl.mp4");

    response.body.pipe(fileStream);

    fileStream.on("finish", () => console.log("Done!"));
    fileStream.on("error", (err) => console.error("Stream Error:", err));
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
