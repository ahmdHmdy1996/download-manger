const YTDlpWrap = require("yt-dlp-wrap").default;

const url = "https://youtube.com/shorts/f8zA_OOBnNA?si=Yg-_jsIhdVuNWCdk";

async function run() {
  try {
    const ytDlpWrap = new YTDlpWrap();

    console.log("Fetching info...");
    const info = await ytDlpWrap.getVideoInfo(url);
    console.log("Title:", info.title);
    console.log("Duration:", info.duration);

    console.log("\nStarting download...");
    const ytDlpProcess = ytDlpWrap.exec([
      url,
      "--format",
      "best",
      "--output",
      "test-yt-dlp.mp4",
      "--progress",
      "--newline",
    ]);

    ytDlpProcess.stdout.on("data", (chunk) => {
      console.log(chunk.toString().trim());
    });

    ytDlpProcess.stderr.on("data", (chunk) => {
      console.error("stderr:", chunk.toString());
    });

    ytDlpProcess.on("exit", (code) => {
      console.log(`\nyt-dlp exited with code ${code}`);
    });
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
