const YouTubeDownloadTask = require("./src/core/YouTubeDownloadTask");
const path = require("path");
const fs = require("fs");

const url = "https://www.youtube.com/watch?v=jNQXAC9IVRw";
const savePath = path.join(__dirname, "downloads");

if (!fs.existsSync(savePath)) {
  fs.mkdirSync(savePath);
}

const task = new YouTubeDownloadTask(
  {
    id: "test",
    url: url,
    savePath: savePath,
    filename: null,
  },
  {}
);

task.on("progress", (p) => console.log("Progress:", p.percentage));
task.on("completed", () => console.log("Completed"));
task.on("error", (e) => console.error("Error:", e));

console.log("Starting task...");
task.start();
