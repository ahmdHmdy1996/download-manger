const fs = require("fs");
const path = require("path");
const { EventEmitter } = require("events");
const YTDlpWrap = require("yt-dlp-wrap").default;

class YouTubeDownloadTask extends EventEmitter {
  constructor(data, settings) {
    super();
    this.id = data.id;
    this.url = data.url;
    this.filename = data.filename;
    this.savePath = data.savePath || path.dirname(data.filePath);
    this.filePath = data.filePath;
    this.totalSize = data.totalSize || 0;
    this.downloadedSize = data.downloadedSize || 0;
    this.status = data.status || "waiting";
    this.error = data.error || null;
    this.startTime = data.startTime || Date.now();
    this.speed = 0;
    this.eta = 0;
    this.lastSpeedUpdate = Date.now();
    this.lastDownloadedSize = this.downloadedSize;

    this.settings = settings;
    this.ytDlpWrap = new YTDlpWrap();
    this.abortController = null;
  }

  async start() {
    if (this.status === "downloading") return;

    this.status = "downloading";
    this.error = null;
    this.startTime = Date.now();
    this.emit("status", "downloading");

    try {
      console.log(
        `[YouTubeDownloadTask] Starting download for URL: "${this.url}"`
      );

      // 1. Get Video Info
      if (!this.filename || this.totalSize === 0) {
        console.log("[YouTubeDownloadTask] Fetching video info...");
        try {
          const info = await this.ytDlpWrap.getVideoInfo(this.url);
          console.log("[YouTubeDownloadTask] Info fetched. Title:", info.title);

          // Sanitize title for filename
          const title = info.title.replace(/[<>:"/\\|?*]/g, "");
          this.filename = `${title}.mp4`;
          this.filePath = path.join(this.savePath, this.filename);

          // Try to get file size from formats
          if (info.formats && info.formats.length > 0) {
            const bestFormat =
              info.formats.find((f) => f.filesize) || info.formats[0];
            if (bestFormat.filesize) {
              this.totalSize = bestFormat.filesize;
            }
          }
        } catch (infoError) {
          console.error(
            "[YouTubeDownloadTask] Error fetching info:",
            infoError
          );
          throw infoError;
        }
      }

      console.log(`[YouTubeDownloadTask] Filename: ${this.filename}`);

      // Ensure directory exists
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 2. Start Download with yt-dlp
      console.log("[YouTubeDownloadTask] Creating download...");

      this.abortController = new AbortController();

      const downloadOptions = [
        "--format",
        "best",
        "--output",
        this.filePath,
        "--no-playlist",
        "--progress",
        "--newline",
      ];

      const ytDlpProcess = this.ytDlpWrap.exec(
        [this.url, ...downloadOptions],
        {},
        this.abortController.signal
      );

      ytDlpProcess.stdout.on("data", (chunk) => {
        const output = chunk.toString();

        // Parse progress from yt-dlp output
        // Format: [download]  45.2% of 10.50MiB at 1.23MiB/s ETA 00:05
        const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/);
        const sizeMatch = output.match(/of\s+([\d.]+)([KMG]iB)/);
        const speedMatch = output.match(/at\s+([\d.]+)([KMG]iB)\/s/);
        const etaMatch = output.match(/ETA\s+(\d+):(\d+)/);

        if (progressMatch) {
          const percentage = parseFloat(progressMatch[1]);

          if (sizeMatch) {
            const size = parseFloat(sizeMatch[1]);
            const unit = sizeMatch[2];
            const multiplier =
              unit === "GiB" ? 1073741824 : unit === "MiB" ? 1048576 : 1024;
            this.totalSize = Math.floor(size * multiplier);
            this.downloadedSize = Math.floor(
              this.totalSize * (percentage / 100)
            );
          }

          if (speedMatch) {
            const speed = parseFloat(speedMatch[1]);
            const unit = speedMatch[2];
            const multiplier =
              unit === "GiB" ? 1073741824 : unit === "MiB" ? 1048576 : 1024;
            this.speed = speed * multiplier;
          }

          if (etaMatch) {
            const minutes = parseInt(etaMatch[1]);
            const seconds = parseInt(etaMatch[2]);
            this.eta = minutes * 60 + seconds;
          }

          this.emit("progress", {
            downloadedSize: this.downloadedSize,
            totalSize: this.totalSize,
            speed: this.speed,
            eta: this.eta,
            percentage: percentage,
          });
        }
      });

      ytDlpProcess.stderr.on("data", (chunk) => {
        console.error("[YouTubeDownloadTask] stderr:", chunk.toString());
      });

      await new Promise((resolve, reject) => {
        ytDlpProcess.on("exit", (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`yt-dlp exited with code ${code}`));
          }
        });

        ytDlpProcess.on("error", reject);
      });

      this.status = "completed";
      this.emit("completed");
      this.emit("status", "completed");
    } catch (error) {
      this.handleError(error);
    }
  }

  async pause() {
    if (this.status !== "downloading") return;

    this.status = "paused";
    if (this.abortController) {
      this.abortController.abort();
    }
    this.emit("status", "paused");
  }

  async resume() {
    if (this.status === "downloading") return;
    console.log("Resuming YouTube download...");
    // yt-dlp doesn't support resume well, so restart
    this.downloadedSize = 0;
    await this.start();
  }

  async cancel() {
    this.status = "cancelled";
    if (this.abortController) {
      this.abortController.abort();
    }
    this.cleanupFiles();
    this.emit("status", "cancelled");
  }

  cleanupFiles() {
    try {
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath);
      }
    } catch (e) {
      console.error("Cleanup error:", e);
    }
  }

  handleError(error) {
    if (this.status === "cancelled") return;

    console.error(`YouTube Download error:`, error);

    if (this.abortController) {
      this.abortController.abort();
    }

    this.status = "error";
    this.error = error.message;
    this.emit("error", error.message);
    this.emit("status", "error");
  }
}

module.exports = YouTubeDownloadTask;
