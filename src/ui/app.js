const { ipcRenderer } = require('electron');

class DownloadManagerUI {
  constructor() {
    this.downloads = new Map();
    this.sidebar = null;
    this.init();
    this.setupNotificationSounds();
  }

  setupNotificationSounds() {
    // Listen for notification sound requests
    ipcRenderer.on('play-notification-sound', (event, type) => {
      this.playNotificationSound(type);
    });
  }

  playNotificationSound(type) {
    // Create audio context for generating sounds
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (type === 'complete') {
      // Success sound: pleasant ascending tone
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } else if (type === 'error') {
      // Error sound: low descending tone
      oscillator.frequency.setValueAtTime(400, audioContext.currentTime); // G4
      oscillator.frequency.setValueAtTime(300, audioContext.currentTime + 0.1); // D4
      oscillator.type = 'sawtooth';
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    }
  }

  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('dragOverlay').classList.add('active');
  }

  handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    // Only remove if leaving the window (clientY is 0 or window height)
    if (e.clientY <= 0 || e.clientY >= window.innerHeight || e.clientX <= 0 || e.clientX >= window.innerWidth) {
      document.getElementById('dragOverlay').classList.remove('active');
    }
  }

  handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('dragOverlay').classList.remove('active');

    const text = e.dataTransfer.getData('text');
    if (text && Utils.isValidUrl(text)) {
      this.urlInput.value = text;
      this.addDownload();
    } else if (e.dataTransfer.files.length > 0) {
      // Handle dropped files (e.g. .torrent or list of URLs)
      // For now, just notify
      Utils.showNotification('Please drop a URL string', 'info');
    }
  }

  init() {
    // DOM elements
    this.urlInput = document.getElementById('urlInput');
    this.addDownloadBtn = document.getElementById('addDownloadBtn');
    this.downloadsList = document.getElementById('downloadsList');
    this.emptyState = document.getElementById('emptyState');
    this.settingsBtn = document.getElementById('settingsBtn');
    this.settingsModal = document.getElementById('settingsModal');
    this.closeSettingsBtn = document.getElementById('closeSettingsBtn');
    this.saveSettingsBtn = document.getElementById('saveSettingsBtn');
    this.browsePathBtn = document.getElementById('browsePathBtn');
    
    // Stats
    this.activeCount = document.getElementById('activeCount');
    this.completedCount = document.getElementById('completedCount');
    this.totalSpeed = document.getElementById('totalSpeed');

    // Initialize sidebar
    this.sidebar = new SidebarManager(this);

    // Event listeners
    this.addDownloadBtn.addEventListener('click', () => this.addDownload());
    this.urlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addDownload();
    });
    
    // Drag & Drop listeners
    document.addEventListener('dragover', (e) => this.handleDragOver(e));
    document.addEventListener('dragleave', (e) => this.handleDragLeave(e));
    document.addEventListener('drop', (e) => this.handleDrop(e));
    
    if (this.settingsBtn) {
      this.settingsBtn.addEventListener('click', () => this.openSettings());
    }
    this.closeSettingsBtn.addEventListener('click', () => this.closeSettings());
    this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
    this.browsePathBtn.addEventListener('click', () => this.browseDownloadPath());

    // IPC listeners
    ipcRenderer.on('download-progress', (event, downloadId, progress) => {
      this.updateDownloadProgress(downloadId, progress);
    });

    ipcRenderer.on('download-completed', (event, downloadId) => {
      this.updateDownloadStatus(downloadId, 'completed');
    });

    ipcRenderer.on('download-error', (event, downloadId, error) => {
      this.updateDownloadStatus(downloadId, 'error', error);
    });

    // Load existing downloads
    this.loadDownloads();
    
    // Update stats periodically
    setInterval(() => this.updateStats(), 1000);

    // Mark as loaded to fade in
    setTimeout(() => {
      document.body.classList.add('loaded');
    }, 50);
  }

  async loadDownloads() {
    console.log('Loading existing downloads...');
    const downloads = await ipcRenderer.invoke('get-downloads');
    console.log(`Found ${downloads.length} downloads`);
    
    downloads.forEach(download => {
      console.log(`Loading download: ${download.id} - ${download.filename} (${download.status})`);
      this.addDownloadToUI(download);
    });
    
    this.updateEmptyState();
    this.sidebar.updateBadges(Array.from(this.downloads.values()));
  }

  async addDownload() {
    const url = this.urlInput.value.trim();
    
    if (!url) {
      Utils.showNotification('Please enter a URL', 'error');
      return;
    }

    if (!Utils.isValidUrl(url)) {
      Utils.showNotification('Please enter a valid URL', 'error');
      return;
    }

    const result = await ipcRenderer.invoke('add-download', url, null);
    
    if (result.success) {
      this.urlInput.value = '';
      Utils.showNotification('Download added successfully', 'success');
      
      // Show popup window
      await ipcRenderer.invoke('show-popup');
      
      // Reload downloads
      setTimeout(() => this.loadDownloads(), 500);
    } else {
      Utils.showNotification(`Failed to add download: ${result.error}`, 'error');
    }
  }

  addDownloadToUI(download) {
    if (this.downloads.has(download.id)) {
      return;
    }

    this.downloads.set(download.id, download);

    const downloadItem = DownloadRenderer.renderDownloadItem(download);
    this.downloadsList.insertBefore(downloadItem, this.downloadsList.firstChild);
    this.attachDownloadActions(download.id);
    this.updateEmptyState();
    this.sidebar.updateBadges(Array.from(this.downloads.values()));
  }

  attachDownloadActions(downloadId) {
    const downloadItem = document.getElementById(`download-${downloadId}`);
    if (!downloadItem) {
      console.error(`Download item not found: ${downloadId}`);
      return;
    }

    const actionButtons = downloadItem.querySelectorAll('.action-btn');
    console.log(`Attaching ${actionButtons.length} action buttons for download ${downloadId}`);
    
    actionButtons.forEach(btn => {
      const action = btn.dataset.action;
      console.log(`Attaching ${action} button for download ${downloadId}`);
      
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log(`Button clicked: ${action} for download ${downloadId}`);
        await this.handleDownloadAction(downloadId, action);
      });
    });
  }

  async handleDownloadAction(downloadId, action) {
    console.log(`Handling action: ${action} for download ${downloadId}`);
    
    try {
      switch (action) {
        case 'pause':
          await ipcRenderer.invoke('pause-download', downloadId);
          this.updateDownloadStatus(downloadId, 'paused');
          break;
        case 'resume':
          await ipcRenderer.invoke('resume-download', downloadId);
          this.updateDownloadStatus(downloadId, 'downloading');
          break;
        case 'cancel':
          await ipcRenderer.invoke('cancel-download', downloadId);
          this.updateDownloadStatus(downloadId, 'cancelled');
          break;
        case 'open-file':
          await ipcRenderer.invoke('open-file', downloadId);
          break;
        case 'show-folder':
          await ipcRenderer.invoke('show-folder', downloadId);
          break;
        case 'remove':
          console.log(`Removing download ${downloadId}`);
          await ipcRenderer.invoke('remove-download', downloadId);
          this.removeDownloadFromUI(downloadId);
          break;
        default:
          console.warn(`Unknown action: ${action}`);
      }
    } catch (error) {
      console.error(`Error handling action ${action}:`, error);
      Utils.showNotification(`Error: ${error.message}`, 'error');
    }
  }

  updateDownloadProgress(downloadId, progress) {
    const download = this.downloads.get(downloadId);
    if (!download) return;

    download.downloadedSize = progress.downloadedSize;
    download.speed = progress.speed;
    download.percentage = progress.percentage;

    const downloadItem = document.getElementById(`download-${downloadId}`);
    if (!downloadItem) return;

    DownloadRenderer.updateProgress(downloadItem, {
      percentage: progress.percentage,
      downloadedSize: progress.downloadedSize,
      totalSize: download.totalSize,
      speed: progress.speed
    });
  }

  updateDownloadStatus(downloadId, status, error = null) {
    const download = this.downloads.get(downloadId);
    if (!download) return;

    download.status = status;
    if (error) download.error = error;

    const downloadItem = document.getElementById(`download-${downloadId}`);
    if (!downloadItem) return;

    DownloadRenderer.updateStatus(downloadItem, status);

    // Update action buttons
    const actionsContainer = downloadItem.querySelector('.download-actions');
    if (actionsContainer) {
      actionsContainer.innerHTML = DownloadRenderer.getActionButtons(download);
      this.attachDownloadActions(downloadId);
    }

    this.sidebar.updateBadges(Array.from(this.downloads.values()));

    if (status === 'completed') {
      Utils.showNotification(`Download completed: ${download.filename}`, 'success');
    } else if (status === 'error') {
      Utils.showNotification(`Download error: ${error}`, 'error');
    }
  }

  removeDownloadFromUI(downloadId) {
    const downloadItem = document.getElementById(`download-${downloadId}`);
    if (downloadItem) {
      downloadItem.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        downloadItem.remove();
        this.downloads.delete(downloadId);
        this.updateEmptyState();
        this.sidebar.updateBadges(Array.from(this.downloads.values()));
      }, 300);
    }
  }

  updateEmptyState() {
    const visibleItems = Array.from(document.querySelectorAll('.download-item:not(.hidden)'));
    
    if (visibleItems.length === 0) {
      this.emptyState.style.display = 'flex';
      this.downloadsList.style.display = 'none';
    } else {
      this.emptyState.style.display = 'none';
      this.downloadsList.style.display = 'flex';
    }
  }

  updateStats() {
    let active = 0;
    let completed = 0;
    let totalSpeedValue = 0;

    this.downloads.forEach(download => {
      if (download.status === 'downloading') {
        active++;
        totalSpeedValue += download.speed || 0;
      } else if (download.status === 'completed') {
        completed++;
      }
    });

    this.activeCount.textContent = active;
    this.completedCount.textContent = completed;
    this.totalSpeed.textContent = Utils.formatSpeed(totalSpeedValue);
  }

  async openSettings() {
    const settings = await ipcRenderer.invoke('get-settings');
    
    document.getElementById('downloadPathInput').value = settings.downloadPath;
    document.getElementById('maxConnectionsInput').value = settings.maxConnections;
    document.getElementById('speedLimitInput').value = settings.speedLimit;
    document.getElementById('autoStartInput').checked = settings.autoStart;
    
    // Load notification settings
    const notificationSettings = settings.notificationSettings || {
      enabled: true,
      sound: true,
      onComplete: true,
      onError: true,
      onPause: false,
      onResume: false
    };
    
    document.getElementById('notificationsEnabledInput').checked = notificationSettings.enabled;
    document.getElementById('notificationSoundInput').checked = notificationSettings.sound;
    document.getElementById('notifyOnCompleteInput').checked = notificationSettings.onComplete;
    document.getElementById('notifyOnErrorInput').checked = notificationSettings.onError;
    document.getElementById('notifyOnPauseInput').checked = notificationSettings.onPause;
    document.getElementById('notifyOnResumeInput').checked = notificationSettings.onResume;
    
    this.settingsModal.classList.add('active');
  }

  closeSettings() {
    this.settingsModal.classList.remove('active');
  }

  async saveSettings() {
    const settings = {
      downloadPath: document.getElementById('downloadPathInput').value,
      maxConnections: parseInt(document.getElementById('maxConnectionsInput').value),
      speedLimit: parseInt(document.getElementById('speedLimitInput').value),
      autoStart: document.getElementById('autoStartInput').checked,
      notificationSettings: {
        enabled: document.getElementById('notificationsEnabledInput').checked,
        sound: document.getElementById('notificationSoundInput').checked,
        onComplete: document.getElementById('notifyOnCompleteInput').checked,
        onError: document.getElementById('notifyOnErrorInput').checked,
        onPause: document.getElementById('notifyOnPauseInput').checked,
        onResume: document.getElementById('notifyOnResumeInput').checked
      }
    };

    const result = await ipcRenderer.invoke('save-settings', settings);
    
    if (result.success) {
      Utils.showNotification('Settings saved successfully', 'success');
      this.closeSettings();
    } else {
      Utils.showNotification('Failed to save settings', 'error');
    }
  }

  async browseDownloadPath() {
    const result = await ipcRenderer.invoke('select-download-path');
    
    if (result.success) {
      document.getElementById('downloadPathInput').value = result.path;
    }
  }
}

// Initialize the app
const app = new DownloadManagerUI();

// Add animations and toast styles
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
  
  .toast {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 1rem 1.5rem;
    border-radius: 12px;
    color: white;
    font-weight: 500;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    opacity: 0;
    transform: translateX(400px);
    transition: all 0.3s ease;
    max-width: 400px;
  }
  
  .toast.show {
    opacity: 1;
    transform: translateX(0);
  }
  
  .toast-success {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  }
  
  .toast-error {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  }
  
  .toast-info {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  }
`;
document.head.appendChild(style);
