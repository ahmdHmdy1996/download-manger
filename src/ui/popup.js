const { ipcRenderer } = require('electron');

class PopupManager {
  constructor() {
    this.activeDownloads = new Map();
    this.init();
  }

  init() {
    // DOM elements
    this.downloadsContainer = document.getElementById('popupDownloads');
    this.emptyMessage = document.getElementById('emptyMessage');
    this.closeBtn = document.getElementById('closeBtn');
    this.minimizeBtn = document.getElementById('minimizeBtn');

    // Event listeners
    this.closeBtn.addEventListener('click', () => this.closePopup());
    this.minimizeBtn.addEventListener('click', () => this.minimizePopup());

    // IPC listeners
    ipcRenderer.on('download-progress', (event, downloadId, progress) => {
      this.updateDownload(downloadId, progress);
    });

    ipcRenderer.on('download-completed', (event, downloadId) => {
      this.removeDownload(downloadId);
    });

    ipcRenderer.on('download-error', (event, downloadId, error) => {
      this.removeDownload(downloadId);
    });

    // Load active downloads
    this.loadActiveDownloads();
  }

  async loadActiveDownloads() {
    try {
      const downloads = await ipcRenderer.invoke('get-downloads');
      console.log('Loaded downloads:', downloads);
      
      downloads.forEach(download => {
        // Show downloads that are actively downloading or waiting
        if (download.status === 'downloading' || download.status === 'waiting') {
          console.log('Adding download to popup:', download.filename);
          this.addDownload(download);
        }
      });
      
      this.updateEmptyState();
    } catch (error) {
      console.error('Error loading downloads:', error);
    }
  }

  addDownload(download) {
    if (this.activeDownloads.has(download.id)) {
      return;
    }

    this.activeDownloads.set(download.id, download);

    const downloadItem = document.createElement('div');
    downloadItem.className = 'popup-download-item';
    downloadItem.id = `popup-download-${download.id}`;

    const isPaused = download.status === 'paused';
    const isDownloading = download.status === 'downloading';

    downloadItem.innerHTML = `
      <div class="download-header">
        <div class="download-name" title="${download.filename}">${download.filename}</div>
        <div class="download-controls">
          ${isDownloading ? `
            <button class="control-btn pause-btn" data-id="${download.id}" title="Pause">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
              </svg>
            </button>
          ` : ''}
          ${isPaused ? `
            <button class="control-btn resume-btn" data-id="${download.id}" title="Resume">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </button>
          ` : ''}
          <button class="control-btn cancel-btn" data-id="${download.id}" title="Cancel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      <div class="progress-container">
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${download.percentage || 0}%"></div>
        </div>
        <div class="progress-stats">
          <span class="progress-percentage">${(download.percentage || 0).toFixed(1)}%</span>
          <span class="progress-speed">${this.formatSpeed(download.speed || 0)}</span>
        </div>
        <div class="progress-size">${this.formatBytes(download.downloadedSize || 0)} / ${this.formatBytes(download.totalSize || 0)}</div>
      </div>
    `;

    this.downloadsContainer.appendChild(downloadItem);
    
    // Add event listeners to buttons
    const pauseBtn = downloadItem.querySelector('.pause-btn');
    const resumeBtn = downloadItem.querySelector('.resume-btn');
    const cancelBtn = downloadItem.querySelector('.cancel-btn');

    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => this.pauseDownload(download.id));
    }
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => this.resumeDownload(download.id));
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.cancelDownload(download.id));
    }

    this.updateEmptyState();
  }

  async updateDownload(downloadId, progress) {
    let download = this.activeDownloads.get(downloadId);
    
    if (!download) {
      // New download started - fetch full info
      try {
        const downloads = await ipcRenderer.invoke('get-downloads');
        const fullDownload = downloads.find(d => d.id === downloadId);
        
        if (fullDownload) {
          download = fullDownload;
          this.addDownload(download);
        } else {
          // Fallback: create basic download object
          download = {
            id: downloadId,
            filename: 'Downloading...',
            totalSize: progress.totalSize || 0,
            downloadedSize: progress.downloadedSize || 0,
            speed: progress.speed || 0,
            percentage: progress.percentage || 0,
            status: 'downloading'
          };
          this.addDownload(download);
        }
      } catch (error) {
        console.error('Error fetching download info:', error);
        return;
      }
    }

    // Update download data
    download.downloadedSize = progress.downloadedSize;
    download.totalSize = progress.totalSize;
    download.speed = progress.speed;
    download.percentage = progress.percentage;

    const downloadItem = document.getElementById(`popup-download-${downloadId}`);
    if (!downloadItem) return;

    const progressBar = downloadItem.querySelector('.progress-bar-fill');
    const progressPercentage = downloadItem.querySelector('.progress-percentage');
    const progressSpeed = downloadItem.querySelector('.progress-speed');
    const progressSize = downloadItem.querySelector('.progress-size');

    if (progressBar) progressBar.style.width = `${progress.percentage}%`;
    if (progressPercentage) progressPercentage.textContent = `${progress.percentage.toFixed(1)}%`;
    if (progressSpeed) progressSpeed.textContent = this.formatSpeed(progress.speed);
    if (progressSize) progressSize.textContent = `${this.formatBytes(progress.downloadedSize)} / ${this.formatBytes(progress.totalSize)}`;
  }

  async refreshDownloadButtons(downloadId) {
    try {
      const downloads = await ipcRenderer.invoke('get-downloads');
      const download = downloads.find(d => d.id === downloadId);
      
      if (!download) return;

      const downloadItem = document.getElementById(`popup-download-${downloadId}`);
      if (!downloadItem) return;

      const controlsDiv = downloadItem.querySelector('.download-controls');
      if (!controlsDiv) return;

      const isPaused = download.status === 'paused';
      const isDownloading = download.status === 'downloading';

      controlsDiv.innerHTML = `
        ${isDownloading ? `
          <button class="control-btn pause-btn" data-id="${download.id}" title="Pause">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="6" y="4" width="4" height="16"></rect>
              <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
          </button>
        ` : ''}
        ${isPaused ? `
          <button class="control-btn resume-btn" data-id="${download.id}" title="Resume">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </button>
        ` : ''}
        <button class="control-btn cancel-btn" data-id="${download.id}" title="Cancel">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;

      // Re-attach event listeners
      const pauseBtn = controlsDiv.querySelector('.pause-btn');
      const resumeBtn = controlsDiv.querySelector('.resume-btn');
      const cancelBtn = controlsDiv.querySelector('.cancel-btn');

      if (pauseBtn) pauseBtn.addEventListener('click', () => this.pauseDownload(download.id));
      if (resumeBtn) resumeBtn.addEventListener('click', () => this.resumeDownload(download.id));
      if (cancelBtn) cancelBtn.addEventListener('click', () => this.cancelDownload(download.id));
    } catch (error) {
      console.error('Error refreshing buttons:', error);
    }
  }

  removeDownload(downloadId) {
    const downloadItem = document.getElementById(`popup-download-${downloadId}`);
    if (downloadItem) {
      downloadItem.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        downloadItem.remove();
        this.activeDownloads.delete(downloadId);
        this.updateEmptyState();
        
        // Close popup if no more downloads
        if (this.activeDownloads.size === 0) {
          setTimeout(() => this.closePopup(), 1000);
        }
      }, 300);
    }
  }

  updateEmptyState() {
    if (this.activeDownloads.size === 0) {
      this.emptyMessage.style.display = 'flex';
    } else {
      this.emptyMessage.style.display = 'none';
    }
  }

  async pauseDownload(downloadId) {
    try {
      await ipcRenderer.invoke('pause-download', downloadId);
      console.log('Download paused:', downloadId);
      // Refresh buttons to show resume
      setTimeout(() => this.refreshDownloadButtons(downloadId), 300);
    } catch (error) {
      console.error('Error pausing download:', error);
    }
  }

  async resumeDownload(downloadId) {
    try {
      await ipcRenderer.invoke('resume-download', downloadId);
      console.log('Download resumed:', downloadId);
      // Refresh buttons to show pause
      setTimeout(() => this.refreshDownloadButtons(downloadId), 300);
    } catch (error) {
      console.error('Error resuming download:', error);
    }
  }

  async cancelDownload(downloadId) {
    try {
      await ipcRenderer.invoke('cancel-download', downloadId);
      console.log('Download cancelled:', downloadId);
      this.removeDownload(downloadId);
    } catch (error) {
      console.error('Error cancelling download:', error);
    }
  }

  async closePopup() {
    await ipcRenderer.invoke('close-popup');
  }

  async minimizePopup() {
    await ipcRenderer.invoke('minimize-popup');
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatSpeed(bytesPerSecond) {
    if (bytesPerSecond === 0) return '0 KB/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
    return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Initialize popup
const popup = new PopupManager();

// Add slide out animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideOut {
    from {
      opacity: 1;
      transform: translateX(0);
    }
    to {
      opacity: 0;
      transform: translateX(100%);
    }
  }
`;
document.head.appendChild(style);
