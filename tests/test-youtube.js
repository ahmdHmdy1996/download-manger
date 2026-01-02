const DownloadManager = require("./src/downloadManager");
const path = require("path");
const fs = require("fs");

// Mock store
const store = {
  get: () => [],
  set: (key, value) => console.log("Store set:", key, value.length),
};

const manager = new DownloadManager(store);

manager.on("progress", (id, progress) => {
  process.stdout.write(
    `\rProgress ${id}: ${progress.percentage.toFixed(
      2
    )}% - ${progress.speed.toFixed(2)} KB/s`
  );
});

manager.on("completed", (id) => {
  console.log(`\nCompleted ${id}`);
  process.exit(0);
});

manager.on("error", (id, error) => {
  console.error(`\nError ${id}:`, error);
  process.exit(1);
});

// Add a YouTube download
// Using a short video for testing: "Me at the zoo"
const url = "https://www.youtube.com/watch?v=jNQXAC9IVRw";
const savePath = path.join(__dirname, "downloads");

if (!fs.existsSync(savePath)) {
  fs.mkdirSync(savePath);
}

console.log("Adding download...");
manager.addDownload(url, savePath).then((id) => {
  console.log("Download added with ID:", id);
});
