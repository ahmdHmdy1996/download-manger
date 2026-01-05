document.addEventListener("DOMContentLoaded", async () => {
  const videoList = document.getElementById("video-list");

  // Get the current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) {
    showEmptyState("No active tab found.");
    return;
  }

  // Request videos for this tab from the background script
  chrome.runtime.sendMessage(
    { action: "GET_VIDEOS", tabId: tab.id },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error fetching videos:", chrome.runtime.lastError);
        showEmptyState("Error communicating with extension background.");
        return;
      }

      const videos = response.videos || [];
      renderVideos(videos);
    }
  );
});

function renderVideos(videos) {
  const videoList = document.getElementById("video-list");
  videoList.innerHTML = "";

  if (videos.length === 0) {
    showEmptyState("No videos detected on this page.");
    return;
  }

  videos.forEach((video) => {
    const item = document.createElement("li");
    item.className = "video-item";

    const name = document.createElement("div");
    name.className = "video-name";
    name.textContent = video.filename || "Unknown Video";
    name.title = video.filename;

    const url = document.createElement("div");
    url.className = "video-url";
    url.textContent = video.url;
    url.title = video.url;

    const btn = document.createElement("button");
    btn.className = "download-btn";
    btn.textContent = "Download";
    btn.onclick = () => {
      downloadVideo(video);
      btn.textContent = "Sent to App";
      btn.disabled = true;
      btn.style.backgroundColor = "#28a745";
    };

    item.appendChild(name);
    item.appendChild(url);
    item.appendChild(btn);
    videoList.appendChild(item);
  });
}

function showEmptyState(message) {
  const videoList = document.getElementById("video-list");
  videoList.innerHTML = `<div class="empty-state">${message}</div>`;
}

function downloadVideo(video) {
  chrome.runtime.sendMessage({
    action: "DOWNLOAD_VIDEO",
    video: video,
  });
}
