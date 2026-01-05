// Download UI renderer
class DownloadRenderer {
  static renderDownloadItem(download) {
    const downloadItem = document.createElement('div');
    downloadItem.className = 'download-item';
    downloadItem.id = `download-${download.id}`;
    downloadItem.dataset.status = download.status;
    
    downloadItem.innerHTML = `
      <div class="download-header">
        <div class="download-info">
          <div class="download-filename" title="${download.filename}">${download.filename}</div>
          <div class="download-url" title="${download.url}">${download.url}</div>
        </div>
        <div class="download-actions">
          ${this.getActionButtons(download)}
        </div>
      </div>
      
      <div class="download-progress">
        <div class="progress-bar-container">
          <div class="progress-bar" style="width: ${download.percentage || 0}%"></div>
        </div>
        <div class="progress-info">
          <span class="progress-percentage">${(download.percentage || 0).toFixed(1)}%</span>
          <span class="progress-size">${Utils.formatBytes(download.downloadedSize || 0)} / ${Utils.formatBytes(download.totalSize || 0)}</span>
        </div>
      </div>
      
      <div class="download-stats">
        <div class="stat">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
          </svg>
          <span class="stat-speed">${Utils.formatSpeed(download.speed || 0)}</span>
        </div>
        <div class="stat">
          <span class="download-status status-${download.status}">${download.status}</span>
        </div>
      </div>
    `;

    return downloadItem;
  }

  static getActionButtons(download) {
    const buttons = [];
    
    if (download.status === 'downloading') {
      buttons.push(`
        <button class="action-btn pause" data-action="pause" title="Pause">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
        </button>
      `);
      `);
    } else if (download.status === 'paused' || download.status === 'error') {
      buttons.push(`
        <button class="action-btn resume" data-action="resume" title="Resume">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
        <button class="action-btn edit" data-action="edit" title="Edit Link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
             <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
             <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
      `);
    } else if (download.status === 'completed') {
      buttons.push(`
        <button class="action-btn open-file" data-action="open-file" title="Open File">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </button>
        <button class="action-btn show-folder" data-action="show-folder" title="Show in Folder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>
      `);
    }
    
    // Show cancel button for active downloads
    if (download.status === 'downloading' || download.status === 'waiting' || download.status === 'paused') {
      buttons.push(`
        <button class="action-btn cancel" data-action="cancel" title="Cancel">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `);
    }
    
    // Always show remove button for all downloads
    buttons.push(`
      <button class="action-btn remove" data-action="remove" title="Remove from list">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    `);
    
    return buttons.join('');
  }

  static updateProgress(downloadItem, progress) {
    const progressBar = downloadItem.querySelector('.progress-bar');
    const progressPercentage = downloadItem.querySelector('.progress-percentage');
    const progressSize = downloadItem.querySelector('.progress-size');
    const statSpeed = downloadItem.querySelector('.stat-speed');

    if (progressBar) progressBar.style.width = `${progress.percentage}%`;
    if (progressPercentage) progressPercentage.textContent = `${progress.percentage.toFixed(1)}%`;
    if (progressSize) progressSize.textContent = `${Utils.formatBytes(progress.downloadedSize)} / ${Utils.formatBytes(progress.totalSize)}`;
    if (statSpeed) {
      const etaText = progress.eta ? Utils.formatTime(progress.eta) : '--:--';
      statSpeed.textContent = `${Utils.formatSpeed(progress.speed)} • ${etaText}`;
    }
  }

  static updateStatus(downloadItem, status) {
    const statusBadge = downloadItem.querySelector('.download-status');
    if (statusBadge) {
      statusBadge.className = `download-status status-${status}`;
      statusBadge.textContent = status;
    }
    downloadItem.dataset.status = status;
  }
}
