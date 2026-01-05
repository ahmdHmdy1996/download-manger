const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { EventEmitter } = require("events");
const NetworkUtils = require("./NetworkUtils");

class DownloadTask extends EventEmitter {
  constructor(data, settings) {
    super();
    this.id = data.id;
    this.url = data.url;
    this.filename = data.filename;
    this.savePath = data.savePath || path.dirname(data.filePath); // Ensure we have a save path
    this.filePath = data.filePath;
    this.totalSize = data.totalSize || 0;
    this.downloadedSize = data.downloadedSize || 0;
    this.status = data.status || "waiting";
    this.supportsRanges = data.supportsRanges || false;
    this.chunks = data.chunks || [];
    this.error = data.error || null;
    this.startTime = data.startTime || Date.now();
    this.speed = 0;
    this.eta = 0;
    this.lastSpeedUpdate = Date.now();
    this.lastDownloadedSize = this.downloadedSize;

    this.settings = settings;
    this.headers = data.headers || {};
    this.abortController = null;
  }

  async start() {
    if (this.status === "downloading") return;

    this.status = "downloading";
    this.error = null;
    this.startTime = Date.now();
    this.emit("status", "downloading");

    this.abortController = new AbortController();

    try {
      console.log(`[DownloadTask] Starting download for URL: "${this.url}"`);

      // Set temporary filename from URL if not set
      if (!this.filename) {
        try {
          const urlObj = new URL(this.url);
          this.filename = path.basename(urlObj.pathname) || "download";
        } catch (e) {
          this.filename = "unknown_file";
        }
      }

      // If we don't have size info yet (e.g. new download), fetch it
      if (this.totalSize === 0) {
        console.log("[DownloadTask] Fetching file info...");
        const info = await NetworkUtils.fetchFileInfo(this.url, {
          headers: this.headers,
        });
        this.totalSize = info.totalSize;
        this.supportsRanges = info.supportsRanges;
        // Update filename with the real one from server if available
        if (info.filename) {
          this.filename = info.filename;
        }
        this.filePath = path.join(this.savePath, this.filename);
        console.log(
          `[DownloadTask] File info fetched. Filename: ${this.filename}, Size: ${this.totalSize}`
        );
      }

      // Decide download method
      if (this.supportsRanges && this.totalSize > 1024 * 1024) {
        // > 1MB
        await this.multiThreadedDownload();
      } else {
        await this.singleThreadedDownload();
      }
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
    await this.start();
  }

  async cancel() {
    this.status = "cancelled";
    if (this.abortController) {
      this.abortController.abort();
    }

    // Cleanup files
    this.cleanupFiles();
    this.emit("status", "cancelled");
  }

  cleanupFiles() {
    try {
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath);
      }
      const tempDir = `${this.filePath}.chunks`;
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (e) {
      console.error("Cleanup error:", e);
    }
  }

  handleError(error) {
    if (this.status === "cancelled" || this.status === "paused") return;

    // Check for abort error
    if (
      error.name === "AbortError" ||
      error.message === "canceled" ||
      error.message === "aborted"
    )
      return;

    console.error(`Download error for ${this.filename}:`, error);

    // CRITICAL: Abort all other running chunks/requests
    if (this.abortController) {
      this.abortController.abort();
    }

    this.status = "error";
    this.error = error.message;
    this.emit("error", error.message);
    this.emit("status", "error");
  }

  calculateSpeed(bytesLoaded, timeMs) {
    if (timeMs === 0) return 0;
    return (bytesLoaded / timeMs) * 1000; // bytes per second
  }

  async singleThreadedDownload() {
    try {
      const isResume = this.downloadedSize > 0 && fs.existsSync(this.filePath);
      const startByte = isResume ? this.downloadedSize : 0;

      // Ensure directory exists
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const writer = isResume
        ? fs.createWriteStream(this.filePath, { flags: "a" })
        : fs.createWriteStream(this.filePath);

      const headers = {};
      if (startByte > 0 && this.supportsRanges) {
        headers["Range"] = `bytes=${startByte}-`;
      }

      const config = NetworkUtils.getAxiosConfig(this.url, {
        method: "GET",
        responseType: "stream",
        signal: this.abortController.signal,
        headers: { ...headers, ...this.headers },
        timeout: 60000, // 60 seconds timeout
      });

      console.log(
        `Starting download: ${this.url}, Resume: ${isResume}, StartByte: ${startByte}`
      );
      const response = await axios(config);

      let loadedSinceStart = 0;
      const startTime = Date.now();

      response.data.on("data", (chunk) => {
        loadedSinceStart += chunk.length;
        this.downloadedSize = startByte + loadedSinceStart;
        this.speed = this.calculateSpeed(
          loadedSinceStart,
          Date.now() - startTime
        );

        this.emit("progress", {
          downloadedSize: this.downloadedSize,
          totalSize: this.totalSize,
          speed: this.speed,
          percentage:
            this.totalSize > 0
              ? (this.downloadedSize / this.totalSize) * 100
              : 0,
        });
      });

      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", (err) => {
          console.error("File write error:", err);
          reject(err);
        });
        response.data.on("error", (err) => {
          console.error("Network stream error:", err);
          reject(err);
        });
      });

      this.status = "completed";
      this.emit("completed");
      this.emit("status", "completed");
    } catch (error) {
      // If range request fails (416 Range Not Satisfiable), restart without range
      if (error.response && error.response.status === 416) {
        console.log("Range request failed, restarting from beginning...");
        this.downloadedSize = 0;
        this.supportsRanges = false;
        if (fs.existsSync(this.filePath)) fs.unlinkSync(this.filePath);
        return this.singleThreadedDownload();
      }
      throw error;
    }
  }

  async multiThreadedDownload() {
    const numChunks = Math.min(this.settings.maxConnections || 8, 8);
    const chunkSize = Math.ceil(this.totalSize / numChunks);
    const tempDir = `${this.filePath}.chunks`;

    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    // Initialize chunks if needed
    if (this.chunks.length === 0) {
      for (let i = 0; i < numChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize - 1, this.totalSize - 1);
        this.chunks.push({
          index: i,
          start,
          end,
          downloaded: 0,
          status: "pending",
        });
      }
    }

    // Download chunks
    await Promise.all(
      this.chunks.map((chunk) => this.downloadChunk(chunk, tempDir))
    );

    // Merge
    await this.mergeChunks(tempDir);

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });

    this.status = "completed";
    this.emit("completed");
    this.emit("status", "completed");
  }

  async downloadChunk(chunk, tempDir) {
    if (chunk.status === "completed") return;

    const maxRetries = 5;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        if (
          this.status === "paused" ||
          this.status === "cancelled" ||
          this.status === "error"
        )
          return;

        const chunkPath = path.join(tempDir, `chunk_${chunk.index}`);
        const existingSize = fs.existsSync(chunkPath)
          ? fs.statSync(chunkPath).size
          : 0;

        if (existingSize >= chunk.end - chunk.start + 1) {
          chunk.status = "completed";
          chunk.downloaded = existingSize;
          return;
        }

        chunk.downloaded = existingSize;
        const currentStart = chunk.start + existingSize;

        const writer = fs.createWriteStream(chunkPath, { flags: "a" });

        const config = NetworkUtils.getAxiosConfig(this.url, {
          method: "GET",
          responseType: "stream",
          signal: this.abortController.signal,
          headers: {
            Range: `bytes=${currentStart}-${chunk.end}`,
            ...this.headers,
          },
          timeout: 60000,
        });

        const response = await axios(config);
        let chunkLoaded = 0;

        response.data.on("data", (data) => {
          chunkLoaded += data.length;
          chunk.downloaded = existingSize + chunkLoaded;
          this.updateGlobalProgress();
        });

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on("finish", resolve);
          writer.on("error", reject);
          response.data.on("error", reject);
        });

        chunk.status = "completed";
        return; // Success
      } catch (error) {
        attempt++;
        console.warn(
          `Chunk ${chunk.index} failed (Attempt ${attempt}/${maxRetries}): ${error.message}`
        );

        if (this.abortController.signal.aborted) return; // Don't retry if aborted

        if (attempt >= maxRetries) {
          throw error; // Propagate error after max retries
        }

        // Wait before retry
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }

  updateGlobalProgress() {
    this.downloadedSize = this.chunks.reduce(
      (acc, chunk) => acc + chunk.downloaded,
      0
    );

    // Calculate speed and ETA
    const now = Date.now();
    const timeDiff = now - this.lastSpeedUpdate;

    if (timeDiff >= 1000) {
      // Update speed every second
      const bytesDiff = this.downloadedSize - this.lastDownloadedSize;
      this.speed = (bytesDiff / timeDiff) * 1000;

      this.lastSpeedUpdate = now;
      this.lastDownloadedSize = this.downloadedSize;

      // Calculate ETA (seconds)
      if (this.speed > 0) {
        const remainingBytes = this.totalSize - this.downloadedSize;
        this.eta = Math.ceil(remainingBytes / this.speed);
        console.log(
          `[ETA Debug] Speed: ${this.speed}, Remaining: ${remainingBytes}, ETA: ${this.eta}`
        );
      } else {
        this.eta = 0;
        console.log(`[ETA Debug] Speed is 0, ETA set to 0`);
      }
    }

    this.emit("progress", {
      downloadedSize: this.downloadedSize,
      totalSize: this.totalSize,
      speed: this.speed,
      eta: this.eta,
      percentage: (this.downloadedSize / this.totalSize) * 100,
    });
  }

  async mergeChunks(tempDir) {
    const writer = fs.createWriteStream(this.filePath);

    for (let i = 0; i < this.chunks.length; i++) {
      const chunkPath = path.join(tempDir, `chunk_${i}`);
      const reader = fs.createReadStream(chunkPath);

      await new Promise((resolve, reject) => {
        reader.pipe(writer, { end: false });
        reader.on("end", resolve);
        reader.on("error", reject);
      });
    }

    writer.end();
  }
}

module.exports = DownloadTask;
