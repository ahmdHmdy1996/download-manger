const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Tray,
  Menu,
  Notification,
} = require("electron");
const path = require("path");

// Polyfill File for Node 18 (Electron 27)
if (!global.File) {
  try {
    const { File } = require("buffer");
    if (File) {
      global.File = File;
    }
  } catch (e) {
    console.warn("Failed to polyfill File:", e);
  }
}

const DownloadManager = require("./src/downloadManager");
const Store = require("electron-store");

const store = new Store();
const downloadManager = new DownloadManager(store);

let mainWindow;
let popupWindow;
let tray;

// Notification helper function
function showNotification(title, body, type = "info") {
  const notificationSettings = store.get("notificationSettings") || {
    enabled: true,
    sound: true,
    onComplete: true,
    onError: true,
    onPause: false,
    onResume: false,
  };

  if (!notificationSettings.enabled) return;

  // Check if this type of notification is enabled
  if (type === "complete" && !notificationSettings.onComplete) return;
  if (type === "error" && !notificationSettings.onError) return;
  if (type === "pause" && !notificationSettings.onPause) return;
  if (type === "resume" && !notificationSettings.onResume) return;

  const notification = new Notification({
    title: title,
    body: body,
    icon: path.join(__dirname, "assets", "icon.png"),
    silent: !notificationSettings.sound,
  });

  notification.show();

  // Play sound if enabled
  if (notificationSettings.sound) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("play-notification-sound", type);
    }
  }

  // Handle notification click
  notification.on("click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false, // Don't show until ready
    backgroundColor: "#0f0f23", // Match app background
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, "assets", "icon.png"),
  });

  mainWindow.loadFile("src/ui/index.html");

  // Show window only when ready to prevent flash
  mainWindow.once("ready-to-show", () => {
    // Add small delay to ensure all scripts are loaded
    setTimeout(() => {
      mainWindow.show();
      mainWindow.focus();
    }, 100);
  });

  // Also listen to did-finish-load for extra safety
  mainWindow.webContents.on("did-finish-load", () => {
    console.log("Main window finished loading");
  });

  // Open DevTools in development
  // mainWindow.webContents.openDevTools();

  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, "assets", "icon.png"));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show App",
      click: () => {
        mainWindow.show();
      },
    },
    {
      label: "Show Downloads",
      click: () => {
        if (popupWindow && !popupWindow.isDestroyed()) {
          popupWindow.show();
          popupWindow.focus();
        } else {
          createPopupWindow();
        }
      },
    },
    {
      type: "separator",
    },
    {
      label: "Quit",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip("Download Manager");
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (popupWindow && !popupWindow.isDestroyed()) {
      popupWindow.show();
      popupWindow.focus();
    } else {
      mainWindow.show();
    }
  });
}

function createPopupWindow() {
  console.log("Creating popup window...");

  if (popupWindow && !popupWindow.isDestroyed()) {
    console.log("Popup already exists, showing it");
    popupWindow.show();
    popupWindow.focus();
    return;
  }

  const { screen } = require("electron");
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  console.log(
    "Creating new popup window at position:",
    width - 420,
    height - 220
  );

  popupWindow = new BrowserWindow({
    width: 400,
    height: 200,
    x: width - 420,
    y: height - 220,
    minWidth: 350,
    minHeight: 150,
    maxHeight: 600,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    show: false,
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    backgroundColor: "#1a1a2e",
  });

  popupWindow.loadFile("src/ui/popup.html");

  popupWindow.once("ready-to-show", () => {
    console.log("Popup ready to show");
    popupWindow.show();
    popupWindow.focus();
  });

  popupWindow.on("closed", () => {
    console.log("Popup closed");
    popupWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle("add-download", async (event, url, filename) => {
  try {
    const savePath = store.get("downloadPath") || app.getPath("downloads");
    const downloadId = await downloadManager.addDownload(
      url,
      savePath,
      filename
    );
    return { success: true, downloadId };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("pause-download", async (event, downloadId) => {
  downloadManager.pauseDownload(downloadId);
  return { success: true };
});

ipcMain.handle("resume-download", async (event, downloadId) => {
  downloadManager.resumeDownload(downloadId);

  console.log("Download resumed, showing popup...");
  createPopupWindow();

  return { success: true };
});

ipcMain.handle("cancel-download", async (event, downloadId) => {
  downloadManager.cancelDownload(downloadId);
  return { success: true };
});

ipcMain.handle("remove-download", async (event, downloadId) => {
  downloadManager.removeDownload(downloadId);
  return { success: true };
});

ipcMain.handle("open-file", async (event, downloadId) => {
  const { shell } = require("electron");
  const download = downloadManager.downloads.get(downloadId);
  if (download && download.filePath) {
    const result = await shell.openPath(download.filePath);
    if (result) {
      return { success: false, error: result };
    }
    return { success: true };
  }
  return { success: false, error: "File not found" };
});

ipcMain.handle("show-folder", async (event, downloadId) => {
  const { shell } = require("electron");
  const download = downloadManager.downloads.get(downloadId);
  if (download && download.filePath) {
    shell.showItemInFolder(download.filePath);
    return { success: true };
  }
  return { success: false, error: "File not found" };
});

ipcMain.handle("get-downloads", async () => {
  return downloadManager.getAllDownloads();
});

ipcMain.handle("select-download-path", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    store.set("downloadPath", result.filePaths[0]);
    return { success: true, path: result.filePaths[0] };
  }
  return { success: false };
});

ipcMain.handle("get-settings", async () => {
  return {
    downloadPath: store.get("downloadPath") || app.getPath("downloads"),
    maxConnections: store.get("maxConnections") || 8,
    speedLimit: store.get("speedLimit") || 0,
    autoStart: store.get("autoStart") || true,
    notificationSettings: store.get("notificationSettings") || {
      enabled: true,
      sound: true,
      onComplete: true,
      onError: true,
      onPause: false,
      onResume: false,
    },
  };
});

ipcMain.handle("save-settings", async (event, settings) => {
  store.set("downloadPath", settings.downloadPath);
  store.set("maxConnections", settings.maxConnections);
  store.set("speedLimit", settings.speedLimit);
  store.set("autoStart", settings.autoStart);

  if (settings.notificationSettings) {
    store.set("notificationSettings", settings.notificationSettings);
  }

  downloadManager.updateSettings(settings);
  return { success: true };
});

// Popup window handlers
ipcMain.handle("show-popup", async () => {
  createPopupWindow();
  return { success: true };
});

ipcMain.handle("hide-popup", async () => {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.hide();
  }
  return { success: true };
});

ipcMain.handle("minimize-popup", async () => {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.hide();
  }
  return { success: true };
});

ipcMain.handle("close-popup", async () => {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close();
  }
  return { success: true };
});

// Download progress events
downloadManager.on("progress", (downloadId, progress) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("download-progress", downloadId, progress);
  }
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.webContents.send("download-progress", downloadId, progress);
  }
});

downloadManager.on("completed", (downloadId) => {
  const download = downloadManager.downloads.get(downloadId);

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("download-completed", downloadId);
  }
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.webContents.send("download-completed", downloadId);
  }

  // Show notification
  if (download) {
    showNotification(
      "Download Completed! ✅",
      `${download.filename} has been downloaded successfully`,
      "complete"
    );
  }
});

downloadManager.on("error", (downloadId, error) => {
  const download = downloadManager.downloads.get(downloadId);

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("download-error", downloadId, error);
  }
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.webContents.send("download-error", downloadId, error);
  }

  // Show notification
  if (download) {
    showNotification(
      "Download Failed ❌",
      `${download.filename}: ${error}`,
      "error"
    );
  }
});
