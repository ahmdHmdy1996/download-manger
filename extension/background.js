let port = null;

function connectToNative() {
  try {
    port = chrome.runtime.connectNative("com.downloadmanager.native");

    port.onDisconnect.addListener(() => {
      console.log("Disconnected from native host");
      port = null;
      // Try to reconnect after a delay if needed, or wait for next action
    });

    port.onMessage.addListener((msg) => {
      console.log("Received from native:", msg);
    });
  } catch (err) {
    console.error("Failed to connect to native host:", err);
  }
}

function sendToNative(message) {
  if (!port) {
    connectToNative();
  }
  if (port) {
    try {
      port.postMessage(message);
    } catch (e) {
      console.error("Error posting message:", e);
    }
  }
}

// Handle Downloads
chrome.downloads.onCreated.addListener((downloadItem) => {
  // Ignore downloads that are already cancelled or handled
  if (downloadItem.state !== "in_progress") return;

  // We want to cancel the browser download and send it to our app
  chrome.downloads.cancel(downloadItem.id, () => {
    if (chrome.runtime.lastError) {
      console.error("Failed to cancel download:", chrome.runtime.lastError);
    } else {
      console.log(
        "Download cancelled in Chrome, sending to app:",
        downloadItem.url
      );

      const message = {
        type: "NEW_DOWNLOAD",
        url: downloadItem.url,
        filename: downloadItem.filename,
        fileSize: downloadItem.fileSize,
        mime: downloadItem.mime,
      };

      sendToNative(message);
    }
  });
});

// Video Sniffing (Video/Audio detection)
const VIDEO_EXTENSIONS = [
  ".mp4",
  ".m3u8",
  ".ts",
  ".flv",
  ".mov",
  ".avi",
  ".mkv",
];
const recentUrls = new Set();

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.method !== "GET") return;

    const url = details.url;
    const lowerUrl = url.toLowerCase();

    // Check extensions
    const isVideo = VIDEO_EXTENSIONS.some((ext) => {
      // Simple check: url ends with ext or ext? (query params)
      // Also ignore small segments like .ts to reduce spam unless it's the only thing
      if (ext === ".ts" && !lowerUrl.includes(".m3u8")) return false;
      return lowerUrl.includes(ext);
    });

    if (isVideo) {
      // Prevent duplicate notifications for the same URL
      if (recentUrls.has(url)) return;

      // Also basic debounce/flood protection (same domain/file within 2 seconds?)
      // Let's just track exact URL for now, but clear periodically
      recentUrls.add(url);
      setTimeout(() => recentUrls.delete(url), 10000); // 10 seconds memory

      console.log("Video detected:", url);

      const message = {
        type: "VIDEO_DETECTED",
        url: url,
        referrer: details.initiator || "unknown",
      };

      sendToNative(message);
    }
  },
  { urls: ["<all_urls>"] }
);
