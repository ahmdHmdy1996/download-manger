const { EventEmitter } = require("events");
const crypto = require("crypto");
const DownloadTask = require("./core/DownloadTask");
const YouTubeDownloadTask = require("./core/YouTubeDownloadTask");
const NetworkUtils = require("./core/NetworkUtils");
const ytdl = require("@distube/ytdl-core");

class DownloadManager extends EventEmitter {
  constructor(store) {
    super();
    this.store = store;
    this.downloads = new Map();
    this.settings = {
      maxConnections: store.get("maxConnections") || 8,
      speedLimit: store.get("speedLimit") || 0,
      autoStart: store.get("autoStart") || true,
    };

    this.loadSavedDownloads();
  }

  loadSavedDownloads() {
    const saved = this.store.get("downloads") || [];
    saved.forEach((data) => {
      // Re-hydrate the task
      let task;
      if (data.type === "youtube") {
        task = new YouTubeDownloadTask(data, this.settings);
      } else {
        task = new DownloadTask(data, this.settings);
      }
      this.setupTaskEvents(task);
      this.downloads.set(task.id, task);

      // If it was downloading, set it to paused or waiting depending on autoStart logic
      // Usually better to start in 'paused' state after restart unless auto-resume is wanted
      if (task.status === "downloading") {
        task.status = "paused";
      }
    });
  }

  saveDownloads() {
    const data = Array.from(this.downloads.values()).map((task) => ({
      id: task.id,
      type: task instanceof YouTubeDownloadTask ? "youtube" : "normal",
      url: task.url,
      filename: task.filename,
      filePath: task.filePath,
      savePath: task.savePath,
      totalSize: task.totalSize,
      downloadedSize: task.downloadedSize,
      status: task.status,
      supportsRanges: task.supportsRanges,
      chunks: task.chunks,
      error: task.error,
      startTime: task.startTime,
    }));
    this.store.set("downloads", data);
  }

  setupTaskEvents(task) {
    task.on("progress", (progress) => {
      this.emit("progress", task.id, progress);
    });

    task.on("completed", () => {
      this.saveDownloads();
      this.emit("completed", task.id);
    });

    task.on("error", (error) => {
      this.saveDownloads();
      this.emit("error", task.id, error);
    });

    task.on("status", (status) => {
      this.saveDownloads();
      // We can emit a general status change event if needed
    });
  }

  async addDownload(url, savePath, customFilename = null, options = {}) {
    const id = crypto.randomBytes(16).toString("hex");

    // Initial data
    const data = {
      id,
      url,
      savePath,
      filename: customFilename, // Might be null initially
      headers: options.headers || {},
      status: "waiting",
      startTime: Date.now(),
    };

    let task;
    if (ytdl.validateURL(url)) {
      console.log("Detected YouTube URL");
      data.type = "youtube";
      task = new YouTubeDownloadTask(data, this.settings);
    } else {
      data.type = "normal";
      task = new DownloadTask(data, this.settings);
    }
    this.setupTaskEvents(task);
    this.downloads.set(id, task);
    this.saveDownloads();

    if (this.settings.autoStart) {
      // Don't await this, let it run in background
      task.start().catch((err) => console.error("Auto-start failed:", err));
    }

    return id;
  }

  pauseDownload(id) {
    const task = this.downloads.get(id);
    if (task) task.pause();
  }

  resumeDownload(id) {
    const task = this.downloads.get(id);
    if (task) task.resume();
  }

  cancelDownload(id) {
    const task = this.downloads.get(id);
    if (task) task.cancel();
  }

  removeDownload(id) {
    const task = this.downloads.get(id);
    if (task) {
      if (task.status === "downloading") {
        task.cancel();
      }
      this.downloads.delete(id);
      this.saveDownloads();
    }
  }

  updateDownloadUrl(id, newUrl) {
    const task = this.downloads.get(id);
    if (task) {
      // Logic: Update URL only. If downloading, it needs to be stopped first.
      // We assume UI handles pausing first, or we enforce it.
      if (task.status === "downloading") {
        task.pause();
      }

      console.log(`Updating URL for task ${id} from ${task.url} to ${newUrl}`);
      task.url = newUrl;

      // If error, reset to 'paused' or 'waiting' so it can be retried
      if (task.status === "error") {
        task.status = "paused";
        task.error = null;
      }

      this.saveDownloads();
      return true;
    }
    return false;
  }

  getAllDownloads() {
    return Array.from(this.downloads.values()).map((task) => ({
      id: task.id,
      url: task.url,
      filename: task.filename,
      totalSize: task.totalSize,
      downloadedSize: task.downloadedSize,
      status: task.status,
      speed: task.speed,
      percentage:
        task.totalSize > 0 ? (task.downloadedSize / task.totalSize) * 100 : 0,
    }));
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    // Update active tasks settings
    this.downloads.forEach((task) => {
      task.settings = this.settings;
    });
  }
}

module.exports = DownloadManager;
