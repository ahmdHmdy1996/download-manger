const fs = require("fs");
const path = require("path");
const os = require("os");
const { app } = require("electron");

const HOST_NAME = "com.downloadmanager.native";
const HOST_DESC = "Download Manager Native Host";
const EXTENSION_ID = "jgimggidagjblnfhegekgpmmkihjlipg";
const ALLOWED_ORIGINS = [`chrome-extension://${EXTENSION_ID}/`];

function getManifestPath() {
  const homeDir = os.homedir();
  const platform = os.platform();

  if (platform === "darwin") {
    return path.join(
      homeDir,
      "Library/Application Support/Google/Chrome/NativeMessagingHosts",
      `${HOST_NAME}.json`
    );
  } else if (platform === "linux") {
    return path.join(
      homeDir,
      ".config/google-chrome/NativeMessagingHosts",
      `${HOST_NAME}.json`
    );
  } else if (platform === "win32") {
    // On Windows, we still need registry usually, but writing the file is a good fallback
    // or helpful if we use a specific registry key that points to it.
    // However, standard Chrome on Windows STRICTLY requires Registry for Native Messaging.
    // We will skip Windows auto-registration via file here as it requires regedit.
    // We will logging this limitation.
    return null;
  }
  return null;
}

function getHostScriptPath() {
  // When packaged, we need to point to the actual executable or a script that launches it.
  // For development (unpacked), it's in the native-host folder next to src.
  // For production (packaged), we need to ensure these files are unpacked.

  // Strategy: We will point to a 'wrapper' script that we ensure exists.
  const isPackaged = app.isPackaged;

  // This is tricky in Electron.
  // Simplified User View: Let's assume we copy the native-host folder to `resources` during build.
  let basePath;
  if (isPackaged) {
    basePath = path.join(process.resourcesPath, "native-host");
  } else {
    basePath = path.join(__dirname, "..", "..", "native-host");
  }

  const platform = os.platform();
  if (platform === "win32") {
    return path.join(basePath, "run-host.bat");
  } else {
    return path.join(basePath, "run-host.sh");
  }
}

function ensureNativeHostRegistered() {
  try {
    const platform = os.platform();
    if (platform === "win32") {
      console.log(
        "Windows requires Registry manipulation which requires Admin privileges. Skipping auto-registration."
      );
      return;
    }

    const manifestPath = getManifestPath();
    if (!manifestPath) return;

    const hostScriptPath = getHostScriptPath();

    // 1. Ensure the host script is executable
    if (fs.existsSync(hostScriptPath)) {
      try {
        fs.chmodSync(hostScriptPath, "755");
      } catch (e) {
        console.error("Failed to chmod host script:", e);
      }
    } else {
      console.error(
        `Host script not found at ${hostScriptPath}. Auto-registration might fail.`
      );
    }

    // 2. Prepare content
    const manifest = {
      name: HOST_NAME,
      description: HOST_DESC,
      path: hostScriptPath,
      type: "stdio",
      allowed_origins: ALLOWED_ORIGINS,
    };

    // 3. Write manifest if it doesn't exist or content changed (optional check)
    // For simplicity, we just overwrite to ensure it's always correct path
    const dir = path.dirname(manifestPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`Native Host registered at: ${manifestPath}`);
  } catch (error) {
    console.error("Failed to register native host:", error);
  }
}

module.exports = { ensureNativeHostRegistered };
