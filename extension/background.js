let port = null;

// --- Native Messaging ---
function connectToNative() {
  try {
    port = chrome.runtime.connectNative("com.downloadmanager.native");

    port.onDisconnect.addListener(() => {
      console.log("Disconnected from native host");
      port = null;
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

// --- Video Detection Storage ---
// Map<tabId, Set<string>> where string is the full JSON stringified video object
// We use Set to prevent duplicates easily, but store objects as strings
const detectedVideos = new Map();

function addVideo(tabId, videoInfo) {
  if (!detectedVideos.has(tabId)) {
    detectedVideos.set(tabId, new Set());
  }

  const tabVideos = detectedVideos.get(tabId);
  const videoStr = JSON.stringify(videoInfo);

  if (!tabVideos.has(videoStr)) {
    tabVideos.add(videoStr);
    updateBadge(tabId);
  }
}

function getVideos(tabId) {
  if (!detectedVideos.has(tabId)) return [];
  return Array.from(detectedVideos.get(tabId)).map((s) => JSON.parse(s));
}

function updateBadge(tabId) {
  const count = detectedVideos.has(tabId) ? detectedVideos.get(tabId).size : 0;

  const text = count > 0 ? count.toString() : "";
  chrome.action.setBadgeText({ text: text, tabId: tabId });
  chrome.action.setBadgeBackgroundColor({ color: "#4688F1", tabId: tabId });
}

// --- Event Listeners ---

// 1. Handle regular downloads (keep existing logic)
chrome.downloads.onCreated.addListener((downloadItem) => {
  if (downloadItem.state !== "in_progress") return;

  chrome.downloads.cancel(downloadItem.id, () => {
    if (!chrome.runtime.lastError) {
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

// 2. Clear videos on tab update/refresh
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading") {
    detectedVideos.delete(tabId);
    updateBadge(tabId);
  }
});

// 3. Clear videos on tab remove
chrome.tabs.onRemoved.addListener((tabId) => {
  detectedVideos.delete(tabId);
});

// 4. Video Sniffing
const VIDEO_EXTENSIONS = [
  ".mp4",
  ".m3u8",
  ".ts",
  ".flv",
  ".mov",
  ".avi",
  ".mkv",
];

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.method !== "GET") return;

    const url = details.url;
    const lowerUrl = url.toLowerCase();

    // Check extensions
    const isVideo = VIDEO_EXTENSIONS.some((ext) => {
      if (ext === ".ts" && !lowerUrl.includes(".m3u8")) return false;
      return lowerUrl.includes(ext);
    });

    if (isVideo) {
      // We need the tabId to associate the video with a specific tab
      const tabId = details.tabId;
      if (tabId === -1) return; // Ignore non-tab requests

      console.log("Video detected:", url, "Tab:", tabId);

      const videoInfo = {
        url: url,
        filename: url.split("/").pop().split("?")[0] || "video",
        referrer: details.initiator || "unknown",
      };

      addVideo(tabId, videoInfo);
    }
  },
  { urls: ["<all_urls>"] }
);

// 5. Handle messages from Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "GET_VIDEOS") {
    const videos = getVideos(message.tabId);
    sendResponse({ videos: videos });
  } else if (message.action === "DOWNLOAD_VIDEO") {
    console.log("Downloading video from popup:", message.video);

    const nativeMsg = {
      type: "VIDEO_DETECTED", // Re-using the message type the app expects
      url: message.video.url,
      referrer: message.video.referrer,
    };
    sendToNative(nativeMsg);
  }
});
