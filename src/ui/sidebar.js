// Sidebar navigation handler
class SidebarManager {
  constructor(downloadManager) {
    this.downloadManager = downloadManager;
    this.currentFilter = 'all';
    this.init();
  }

  init() {
    this.navItems = document.querySelectorAll('.nav-item[data-filter]');
    this.downloadingBadge = document.getElementById('downloadingBadge');
    this.completedBadge = document.getElementById('completedBadge');
    this.settingsNavBtn = document.getElementById('settingsNavBtn');

    // Navigation click handlers
    this.navItems.forEach(item => {
      item.addEventListener('click', () => {
        this.navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        this.currentFilter = item.dataset.filter;
        this.filterDownloads();
      });
    });

    // Settings button
    if (this.settingsNavBtn) {
      this.settingsNavBtn.addEventListener('click', () => {
        this.downloadManager.openSettings();
      });
    }
  }

  filterDownloads() {
    const items = document.querySelectorAll('.download-item');
    
    items.forEach(item => {
      const status = item.dataset.status;
      
      if (this.currentFilter === 'all') {
        item.classList.remove('hidden');
      } else if (this.currentFilter === 'downloading') {
        if (status === 'downloading' || status === 'waiting' || status === 'paused') {
          item.classList.remove('hidden');
        } else {
          item.classList.add('hidden');
        }
      } else if (this.currentFilter === 'completed') {
        if (status === 'completed') {
          item.classList.remove('hidden');
        } else {
          item.classList.add('hidden');
        }
      }
    });
    
    this.downloadManager.updateEmptyState();
  }

  updateBadges(downloads) {
    let downloadingCount = 0;
    let completedCount = 0;
    
    downloads.forEach(download => {
      if (download.status === 'downloading' || download.status === 'waiting' || download.status === 'paused') {
        downloadingCount++;
      } else if (download.status === 'completed') {
        completedCount++;
      }
    });
    
    if (this.downloadingBadge) {
      this.downloadingBadge.textContent = downloadingCount;
    }
    if (this.completedBadge) {
      this.completedBadge.textContent = completedCount;
    }
  }
}
