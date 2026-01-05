const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const HOST_NAME = "com.downloadmanager.native";
const HOST_DESC = "Download Manager Native Host";
// The extension ID from your manifest or chrome://extensions
// REPLACE THIS WITH YOUR ACTUAL EXTENSION ID IF DIFFERENT
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
    // Windows usually uses Registry, but can use file in some cases.
    // For this script, we'll focus on Linux/Mac file generation mostly,
    // but let's define a local path for Windows just to output the JSON key if needed.
    return path.join(__dirname, `${HOST_NAME}.json`);
  }
  throw new Error(`Unsupported platform: ${platform}`);
}

function getHostScriptPath() {
  const platform = os.platform();
  if (platform === "win32") {
    return path.resolve(__dirname, "run-host.bat");
  } else {
    return path.resolve(__dirname, "run-host.sh");
  }
}

function install() {
  try {
    const platform = os.platform();
    const manifestPath = getManifestPath();
    const hostScriptPath = getHostScriptPath();

    console.log(`Detected Platform: ${platform}`);
    console.log(`Target Manifest Path: ${manifestPath}`);
    console.log(`Host Script Path: ${hostScriptPath}`);

    // Ensure execute permissions on Unix
    if (platform !== "win32") {
      try {
        fs.chmodSync(hostScriptPath, "755");
        console.log("Made run-host.sh executable.");
      } catch (err) {
        console.error("Failed to set permissions on run-host.sh:", err);
      }
    }

    // Prepare Manifest Content
    const manifest = {
      name: HOST_NAME,
      description: HOST_DESC,
      path: hostScriptPath,
      type: "stdio",
      allowed_origins: ALLOWED_ORIGINS,
    };

    const manifestContent = JSON.stringify(manifest, null, 2);

    // Windows Specifics: Registry is preferred/required for system-wide or user-specific sometimes
    if (platform === "win32") {
      console.log("\n--- WINDOWS INSTALLATION ---");
      console.log("On Windows, you usually need to register via Registry.");
      console.log(
        "Please run 'register.ps1' or 'register.reg' included in this folder."
      );
      console.log("However, updating the local JSON file just in case:");
      fs.writeFileSync(manifestPath, manifestContent);
      console.log(`Updated ${manifestPath}`);
      return;
    }

    // Linux / macOS logic
    const dir = path.dirname(manifestPath);
    if (!fs.existsSync(dir)) {
      console.log(`Directory does not exist, creating: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(manifestPath, manifestContent);
    console.log("\n✅ Native Host Manifest installed successfully!");
    console.log(`Location: ${manifestPath}`);
    console.log(
      "\nYou typically need to restart Chrome for changes to take effect."
    );
  } catch (error) {
    console.error("\n❌ Installation Failed:", error.message);
    console.error(error);
  }
}

install();
